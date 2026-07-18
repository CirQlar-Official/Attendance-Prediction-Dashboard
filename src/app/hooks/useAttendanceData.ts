import { useState, useEffect, useMemo, useId, useRef } from 'react';
import {
  predictForest,
  featureImportances,
  type Forest,
  type RFResult,
} from '../utils/randomForest';
import { RandomForestClient } from '../workers/randomForestClient';
import { supabase, getCurrentUserFullName } from '../../lib/supabase';
import { fetchWeatherForDate } from '../../lib/weather';

export type ChurchEvent =
  | 'None'
  | 'Easter'
  | 'Palm Sunday'
  | 'Mothers Day'
  | 'Fathers Day'
  | 'Christmas'
  | 'Primary Program'
  | 'Other';

export interface AttendanceEntry {
  id: string;
  date: string;
  attendance: number;
  year: number;
  month: number;
  week: number;
  lag1: number;
  lag4: number;
  roll4: number;
  delta1: number;
  delta4: number;
  isSummer: 0 | 1;
  isHolidaySeason: 0 | 1;
  churchEvent: ChurchEvent;
  isFastSunday: 0 | 1;
  low_temp?: number;
  high_temp?: number;
  rainfall?: number;
  snowfall?: number;
  groupId: string;
  createdBy?: string;
  averagedFrom?: Contributor[];
}

export interface Group {
  id: string;
  name: string;
  joinCode: string;
  createdBy?: string;
  createdAt?: string;
}

export const CHURCH_EVENTS: ChurchEvent[] = [
  'None',
  'Easter',
  'Palm Sunday',
  'Mothers Day',
  'Fathers Day',
  'Primary Program',
  'Christmas',
  'Other',
];

export const FEATURE_NAMES = [
  'Lag 1',
  'Lag 4',
  'Roll 4',
  'Delta 1',
  'Delta 4',
  'Is Summer',
  'Is Holiday Season',
  'Church Event',
  'Is Fast Sunday',
  'Month',
  'Week',
  'High Temp',
  'Low Temp',
  'Rainfall',
  'Snowfall',
];

function encodeChurchEvent(ev: ChurchEvent): number {
  const map: Record<ChurchEvent, number> = {
    None: 0,
    Easter: 4,
    'Palm Sunday': 3,
    'Mothers Day': 5,
    'Fathers Day': 6,
    'Primary Program': 7,
    Christmas: 2,
    Other: 1,
  };
  return map[ev] ?? 0;
}

export function toFeatureVector(e: Omit<AttendanceEntry, 'id'>): number[] {
  return [
    e.lag1,
    e.lag4,
    e.roll4,
    e.delta1,
    e.delta4,
    e.isSummer,
    e.isHolidaySeason,
    encodeChurchEvent(e.churchEvent),
    e.isFastSunday,
    e.month,
    e.week,
    e.high_temp || 65,
    e.low_temp || 55,
    e.rainfall || 0,
    e.snowfall || 0,
  ];
}

export function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.ceil(dayOfYear / 7);
}

export function autoIsSummer(month: number): 0 | 1 {
  return month >= 6 && month <= 8 ? 1 : 0;
}

export function autoIsHoliday(month: number): 0 | 1 {
  return month >= 11 ? 1 : 0;
}

export function isFastSundayDate(date: Date): 0 | 1 {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return d.getDate() === date.getDate() ? 1 : 0;
}

export function computeLagFeatures(
  sorted: AttendanceEntry[],
  newAttendance: number
): {
  lag1: number;
  lag4: number;
  roll4: number;
  delta1: number;
  delta4: number;
} {
  const n = sorted.length;
  const lag1 = n >= 1 ? sorted[n - 1].attendance : 0;
  const lag4 = n >= 4 ? sorted[n - 4].attendance : 0;

  const last4 = sorted.slice(-4).map(e => e.attendance);
  const roll4 =
    last4.length > 0
      ? Math.round((last4.reduce((a, b) => a + b, 0) / last4.length) * 100) / 100
      : 0;

  const lag2 = n >= 2 ? sorted[n - 2].attendance : 0;
  const delta1 = lag1 - lag2;
  const delta4 = newAttendance - lag4;

  return { lag1, lag4, roll4, delta1, delta4 };
}

/**
 * Lag/roll/delta figures for a not-yet-known next week, derived from
 * history alone (unlike computeLagFeatures, which also has the actual
 * new attendance value once a record is being saved - so its delta4 is
 * exact rather than an approximation from the last known value).
 * Shared by computeNextWeekFeatures (model input) and the Forecast
 * page's "model inputs" summary panel, so there is one definition of
 * "next week's lag features" instead of two.
 */
export function computeNextWeekLagSummary(sorted: AttendanceEntry[]): {
  lag1: number;
  lag4: number;
  roll4: number;
  delta1: number;
  delta4: number;
} {
  const n = sorted.length;
  const lag1 = n >= 1 ? sorted[n - 1].attendance : 0;
  const lag4 = n >= 4 ? sorted[n - 4].attendance : 0;

  const last4 = sorted.slice(-4).map(e => e.attendance);
  const roll4 =
    last4.length > 0
      ? last4.reduce((a, b) => a + b, 0) / last4.length
      : 0;

  const lag2 = n >= 2 ? sorted[n - 2].attendance : 0;
  const delta1 = lag1 - lag2;
  const delta4 = lag1 - lag4;

  return { lag1, lag4, roll4, delta1, delta4 };
}

export function computeNextWeekFeatures(
  sorted: AttendanceEntry[],
  nextContext: {
    isSummer: 0 | 1;
    isHolidaySeason: 0 | 1;
    churchEvent: ChurchEvent;
    isFastSunday: 0 | 1;
    month: number;
    week: number;
  }
): number[] {
  const { lag1, lag4, roll4, delta1, delta4 } = computeNextWeekLagSummary(sorted);

  const recentWeather = sorted.slice(-4);

  const avgHighTemp =
    recentWeather.length > 0
      ? Math.round(
          recentWeather.reduce((sum, e) => sum + (e.high_temp || 65), 0) /
            recentWeather.length
        )
      : 65;

  const avgLowTemp =
    recentWeather.length > 0
      ? Math.round(
          recentWeather.reduce((sum, e) => sum + (e.low_temp || 55), 0) /
            recentWeather.length
        )
      : 55;

  const avgRainfall =
    recentWeather.length > 0
      ? Math.round(
          (recentWeather.reduce((sum, e) => sum + (e.rainfall || 0), 0) /
            recentWeather.length) *
            10
        ) / 10
      : 0;

  const avgSnowfall =
    recentWeather.length > 0
      ? Math.round(
          (recentWeather.reduce((sum, e) => sum + (e.snowfall || 0), 0) /
            recentWeather.length) *
            10
        ) / 10
      : 0;

  return [
    lag1,
    lag4,
    roll4,
    delta1,
    delta4,
    nextContext.isSummer,
    nextContext.isHolidaySeason,
    encodeChurchEvent(nextContext.churchEvent),
    nextContext.isFastSunday,
    nextContext.month,
    nextContext.week,
    avgHighTemp,
    avgLowTemp,
    avgRainfall,
    avgSnowfall,
  ];
}

export interface Contributor {
  email: string;
  attendance: number;
}

/**
 * Merges a new submission into an existing entry's contributor list for
 * same-date averaging. If the submitter already has a contribution on
 * this entry (matched by their resolved display name - the only identity
 * available today, see getCurrentUserFullName), it is replaced rather
 * than appended, so repeated submissions by the same person converge to
 * their latest value instead of permanently skewing the average.
 */
export function mergeContributor(
  existingContributors: Contributor[],
  submitterName: string,
  newAttendance: number
): { contributors: Contributor[]; attendanceToStore: number } {
  const contributors = [...existingContributors];
  const existingIndex = contributors.findIndex(c => c.email === submitterName);

  if (existingIndex >= 0) {
    contributors[existingIndex] = { email: submitterName, attendance: newAttendance };
  } else {
    contributors.push({ email: submitterName, attendance: newAttendance });
  }

  const total = contributors.reduce((sum, c) => sum + c.attendance, 0);
  const attendanceToStore = Math.round(total / contributors.length);

  return { contributors, attendanceToStore };
}

export interface FeatureUpdate {
  id: string;
  lag1: number;
  lag4: number;
  roll4: number;
  delta1: number;
  delta4: number;
}

/**
 * When an entry's attendance value changes, its own lag/roll/delta
 * features (derived from what came before it) may now be wrong, and so
 * may those of any later entry whose lookback window reached back to
 * it. lag4/roll4 look back at most 4 entries and delta1 at most 2, so
 * the affected set is always the edited entry itself plus at most the
 * 4 entries immediately after it in date order - never the rest of
 * history.
 *
 * `sorted` must be in the same chronological order feature computation
 * elsewhere assumes, and must reflect the OLD attendance value at
 * `editedId` (i.e. call this before applying the edit locally).
 */
export function recomputeForwardFeatures(
  sorted: AttendanceEntry[],
  editedId: string,
  newAttendance: number
): FeatureUpdate[] {
  const editedIndex = sorted.findIndex(e => e.id === editedId);
  if (editedIndex === -1) return [];

  // A working copy of attendance values reflecting the edit, so that
  // downstream entries' lookback windows see the corrected value at
  // editedIndex rather than the stale one still in `sorted`.
  const correctedAttendance = sorted.map(e => e.attendance);
  correctedAttendance[editedIndex] = newAttendance;

  const updates: FeatureUpdate[] = [];
  const lastAffectedIndex = Math.min(sorted.length - 1, editedIndex + 4);

  for (let i = editedIndex; i <= lastAffectedIndex; i++) {
    const history = sorted
      .slice(0, i)
      .map((e, idx) => ({ ...e, attendance: correctedAttendance[idx] }));
    const features = computeLagFeatures(history, correctedAttendance[i]);
    updates.push({ id: sorted[i].id, ...features });
  }

  return updates;
}

/** Maps a raw `attendance_entries` row (snake_case) to the app's AttendanceEntry shape. */
function mapRowToEntry(row: any): AttendanceEntry {
  return {
    id: row.id,
    date: row.date,
    attendance: row.attendance,
    year: row.year,
    month: row.month,
    week: row.week,
    lag1: row.lag1,
    lag4: row.lag4,
    roll4: row.roll4,
    delta1: row.delta1,
    delta4: row.delta4,
    isSummer: row.is_summer,
    isHolidaySeason: row.is_holiday_season,
    churchEvent: row.church_event,
    isFastSunday: row.is_fast_sunday,
    low_temp: row.low_temp,
    high_temp: row.high_temp,
    rainfall: row.rainfall,
    snowfall: row.snowfall,
    groupId: row.group_id,
    createdBy: row.created_by,
    averagedFrom: row.averaged_from ? JSON.parse(row.averaged_from) : undefined,
  };
}

async function loadEntriesFromSupabase(groupId: string | null): Promise<AttendanceEntry[]> {
  if (!groupId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('attendance_entries')
      .select('*')
      .eq('group_id', groupId)
      .order('date', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(mapRowToEntry);
  } catch (error) {
    console.error('Error loading from Supabase:', error);
    return [];
  }
}

/** Like loadEntriesFromSupabase, but reports failure to the caller instead of swallowing it. */
async function loadEntriesOrThrow(groupId: string): Promise<AttendanceEntry[]> {
  const { data, error } = await supabase
    .from('attendance_entries')
    .select('*')
    .eq('group_id', groupId)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRowToEntry);
}

export function useAttendanceData(groupId: string | null) {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // A stable id per mounted hook instance. Supabase's realtime client
  // reuses the SAME underlying channel for any two `.channel(topic)`
  // calls that share a topic string - so a hardcoded topic here would
  // mean every page's independent subscription (and its groupId-based
  // filtering closure) collapses onto one shared channel, and one
  // instance's cleanup-time unsubscribe() can tear down realtime
  // delivery for another still-mounted instance entirely.
  const instanceId = useId();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (!groupId) {
        setEntries([]);
        setLoading(false);
        return;
      }

      try {
        const initialData = await loadEntriesOrThrow(groupId);
        setEntries(initialData);
      } catch (err: any) {
        console.error('Error loading attendance entries:', err);
        setError(err?.message || 'Unable to load attendance data. Please try again.');
        setEntries([]);
      } finally {
        setLoading(false);
      }

      const channel = supabase
        .channel(`attendance_entries:${groupId}:${instanceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'attendance_entries' },
          (payload: any) => {
            const newEntry = payload.new as any;
            if (newEntry.group_id !== groupId) {
              return;
            }
            const mapped = mapRowToEntry(newEntry);
            setEntries(prev =>
              // The client that made the write already applied it optimistically
              // (see addEntry) - without this guard, that same client would also
              // receive its own INSERT back over realtime and duplicate the row.
              prev.some(e => e.id === mapped.id) ? prev : [...prev, mapped]
            );
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'attendance_entries' },
          (payload: any) => {
            const updated = payload.new as any;
            if (updated.group_id !== groupId) {
              return;
            }
            const mapped = mapRowToEntry(updated);
            setEntries(prev => prev.map(e => (e.id === mapped.id ? mapped : e)));
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'attendance_entries' },
          (payload: any) => {
            // DELETE payloads only reliably include the primary key (not
            // group_id) unless the table has REPLICA IDENTITY FULL, which
            // isn't guaranteed here - so filter by whether we actually have
            // this row rather than by group_id.
            const deletedId = (payload.old as any)?.id;
            if (!deletedId) return;
            setEntries(prev => prev.filter(e => e.id !== deletedId));
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    loadData();
  }, [groupId, instanceId]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  const [forest, setForest] = useState<Forest>([]);
  const [modelTraining, setModelTraining] = useState(false);
  const rfClientRef = useRef<RandomForestClient | null>(null);
  const latestRequestIdRef = useRef(-1);

  useEffect(() => {
    rfClientRef.current = new RandomForestClient();
    return () => {
      rfClientRef.current?.terminate();
      rfClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sorted.length < 5) {
      setForest([]);
      setModelTraining(false);
      return;
    }
    if (!rfClientRef.current) return;

    const X = sorted.map(e => toFeatureVector(e));
    const y = sorted.map(e => e.attendance);
    const { requestId, result } = rfClientRef.current.train(X, y);
    latestRequestIdRef.current = requestId;
    setModelTraining(true);

    result.then(trainedForest => {
      // A newer training request may have been fired (sorted changed
      // again) before this one finished - ignore a stale response so an
      // out-of-date forest can't clobber a more recent one.
      if (latestRequestIdRef.current !== requestId) return;
      setForest(trainedForest);
      setModelTraining(false);
    });
  }, [sorted]);

  const deleteEntry = async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    const query = supabase
      .from('attendance_entries')
      .delete()
      .eq('id', id);

    if (groupId) {
      query.eq('group_id', groupId);
    }

    const { error } = await query;
    if (error) {
      console.error('Error deleting entry:', error);
      const restored = await loadEntriesFromSupabase(groupId);
      setEntries(restored);
    }
  };

  const updateEntry = async (id: string, updates: Partial<AttendanceEntry>) => {
    const current = sorted.find(e => e.id === id);
    const attendanceChanged =
      updates.attendance !== undefined && current !== undefined && updates.attendance !== current.attendance;

    // Changing attendance invalidates this entry's own lag/roll/delta
    // features (derived from what came before it) and those of any later
    // entry whose lookback window reached back to it - at most the 4
    // entries immediately after it. Computed from the pre-edit `sorted`
    // so every affected row's lookback sees the corrected chain.
    const forwardUpdates = attendanceChanged
      ? recomputeForwardFeatures(sorted, id, updates.attendance!)
      : [];
    const ownFeatureUpdate = forwardUpdates.find(u => u.id === id);
    const downstreamUpdates = forwardUpdates.filter(u => u.id !== id);

    setEntries(prev =>
      prev.map(e => {
        if (e.id === id) return { ...e, ...updates, ...ownFeatureUpdate };
        const downstream = downstreamUpdates.find(u => u.id === e.id);
        return downstream ? { ...e, ...downstream } : e;
      })
    );

    const query = supabase
      .from('attendance_entries')
      .update({
        attendance: updates.attendance,
        church_event: updates.churchEvent,
        is_fast_sunday: updates.isFastSunday,
        is_summer: updates.isSummer,
        is_holiday_season: updates.isHolidaySeason,
        ...(ownFeatureUpdate && {
          lag1: ownFeatureUpdate.lag1,
          lag4: ownFeatureUpdate.lag4,
          roll4: ownFeatureUpdate.roll4,
          delta1: ownFeatureUpdate.delta1,
          delta4: ownFeatureUpdate.delta4,
        }),
      })
      .eq('id', id);

    if (groupId) {
      query.eq('group_id', groupId);
    }

    const { error } = await query;
    if (error) {
      console.error('Error updating entry:', error);
      const restored = await loadEntriesFromSupabase(groupId);
      setEntries(restored);
      return;
    }

    if (downstreamUpdates.length > 0) {
      const results = await Promise.all(
        downstreamUpdates.map(u => {
          const downstreamQuery = supabase
            .from('attendance_entries')
            .update({
              lag1: u.lag1,
              lag4: u.lag4,
              roll4: u.roll4,
              delta1: u.delta1,
              delta4: u.delta4,
            })
            .eq('id', u.id);

          if (groupId) downstreamQuery.eq('group_id', groupId);
          return downstreamQuery;
        })
      );

      const downstreamError = results.find(r => r.error)?.error;
      if (downstreamError) {
        // Some downstream rows may now be inconsistent with the edit.
        // Reload from the server so the UI reflects actual stored state
        // rather than the optimistic (possibly now-wrong) local values.
        console.error('Error updating downstream lag features:', downstreamError);
        const restored = await loadEntriesFromSupabase(groupId);
        setEntries(restored);
      }
    }
  };

  const addEntry = async (raw: {
    date: string;
    attendance: number;
    isSummer: 0 | 1;
    isHolidaySeason: 0 | 1;
    churchEvent: ChurchEvent;
    isFastSunday: 0 | 1;
  }) => {
    const d = new Date(raw.date + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const week = getWeekOfYear(d);
    const lags = computeLagFeatures(sorted, raw.attendance);

    if (!groupId) {
      throw new Error('No group selected. Please join a group before adding attendance.');
    }

    const weather = await fetchWeatherForDate(d);
    const fullName = await getCurrentUserFullName();

    // Check if an entry already exists for this date
    const { data: existingEntries, error: queryError } = await supabase
      .from('attendance_entries')
      .select('*')
      .eq('date', raw.date)
      .eq('group_id', groupId);

    if (queryError) {
      console.error('Error checking for existing entry:', queryError);
      throw queryError;
    }

    let attendanceToStore = raw.attendance;
    let averagedFrom: Contributor[] | undefined = undefined;
    let entryIdToReplace: string | null = null;

    // If an entry already exists for this date, average this submission
    // into it rather than overwriting or duplicating.
    if (existingEntries && existingEntries.length > 0) {
      const existing = existingEntries[0];
      entryIdToReplace = existing.id;

      let priorContributors: Contributor[] = [];
      if (existing.averaged_from) {
        try {
          priorContributors = JSON.parse(existing.averaged_from);
        } catch (e) {
          console.error('Failed to parse existing averaged_from:', e);
        }
      } else if (existing.created_by) {
        priorContributors = [{ email: existing.created_by, attendance: existing.attendance }];
      }

      const merged = mergeContributor(priorContributors, fullName, raw.attendance);
      attendanceToStore = merged.attendanceToStore;
      averagedFrom = merged.contributors;
    }

    const insertData: any = {
      date: raw.date,
      attendance: attendanceToStore,
      year,
      month,
      week,
      lag1: lags.lag1,
      lag4: lags.lag4,
      roll4: lags.roll4,
      delta1: lags.delta1,
      delta4: lags.delta4,
      is_summer: raw.isSummer,
      is_holiday_season: raw.isHolidaySeason,
      church_event: raw.churchEvent,
      is_fast_sunday: raw.isFastSunday,
      high_temp: weather?.high_temp || 65,
      low_temp: weather?.low_temp || 55,
      rainfall: weather?.rainfall || 0,
      snowfall: weather?.snowfall || 0,
      created_by: fullName,
      group_id: groupId,
    };

    if (averagedFrom) {
      insertData.averaged_from = JSON.stringify(averagedFrom);
    }

    const newEntry: AttendanceEntry = {
      id: entryIdToReplace ?? '',
      date: raw.date,
      attendance: attendanceToStore,
      year,
      month,
      week,
      lag1: lags.lag1,
      lag4: lags.lag4,
      roll4: lags.roll4,
      delta1: lags.delta1,
      delta4: lags.delta4,
      isSummer: raw.isSummer,
      isHolidaySeason: raw.isHolidaySeason,
      churchEvent: raw.churchEvent,
      isFastSunday: raw.isFastSunday,
      high_temp: weather?.high_temp || 65,
      low_temp: weather?.low_temp || 55,
      rainfall: weather?.rainfall || 0,
      snowfall: weather?.snowfall || 0,
      groupId,
      createdBy: fullName,
      averagedFrom,
    };

    // If replacing, update the existing entry instead of delete+insert
    if (entryIdToReplace) {
      const { error } = await supabase
        .from('attendance_entries')
        .update(insertData)
        .eq('id', entryIdToReplace);

      if (error) {
        console.error('Error updating entry:', error);
        throw error;
      }

      setEntries(prev => prev.map(e => (e.id === entryIdToReplace ? newEntry : e)));
    } else {
      const { data: insertedEntry, error } = await supabase
        .from('attendance_entries')
        .insert(insertData)
        .select('*')
        .single();

      if (error) {
        console.error('Error adding entry:', error);
        throw error;
      }

      if (insertedEntry) {
        const savedEntry = mapRowToEntry(insertedEntry);
        setEntries(prev => [...prev, savedEntry]);
      }
    }
  };


  const getStats = () => {
    if (sorted.length === 0) return null;

    const mostRecent = sorted[sorted.length - 1];
    const lastWeek = sorted.length > 1 ? sorted[sorted.length - 2] : null;

    const now = new Date();
    const thisMonth = sorted.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return (
        d.getMonth() + 1 === now.getMonth() + 1 &&
        d.getFullYear() === now.getFullYear()
      );
    });
    const monthAvg =
      thisMonth.length > 0
        ? Math.round(thisMonth.reduce((s, e) => s + e.attendance, 0) / thisMonth.length)
        : 0;

    const thisYear = sorted.filter(
      e => new Date(e.date + 'T12:00:00').getFullYear() === now.getFullYear()
    );
    const ytdAvg =
      thisYear.length > 0
        ? Math.round(thisYear.reduce((s, e) => s + e.attendance, 0) / thisYear.length)
        : 0;

    return {
      current: mostRecent.attendance,
      lastWeek: lastWeek?.attendance ?? 0,
      monthAvg,
      ytdAvg,
    };
  };

  const predictNextAttendance = (context: {
    isSummer: 0 | 1;
    isHolidaySeason: 0 | 1;
    churchEvent: ChurchEvent;
    isFastSunday: 0 | 1;
    month: number;
    week: number;
  }): RFResult & { featureImps: { name: string; importance: number }[] } => {
    const fallback = {
      prediction: 0,
      std: 0,
      treePredictions: [],
      confidence: 'low' as const,
      featureImps: [],
    };
    if (forest.length === 0) return fallback;

    const featureVec = computeNextWeekFeatures(sorted, context);
    const result = predictForest(forest, featureVec);
    const featureImps = featureImportances(forest, FEATURE_NAMES.length, FEATURE_NAMES);

    return { ...result, featureImps };
  };

  return {
    sorted,
    loading,
    error,
    modelTraining,
    addEntry,
    deleteEntry,
    updateEntry,
    getStats,
    predictNextAttendance,
  };
}
