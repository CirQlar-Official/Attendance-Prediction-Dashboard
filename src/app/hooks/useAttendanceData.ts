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
import { WEATHER_DEFAULTS } from '../../config';
import { toast } from 'sonner';

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
    e.high_temp || WEATHER_DEFAULTS.highTemp,
    e.low_temp || WEATHER_DEFAULTS.lowTemp,
    e.rainfall || WEATHER_DEFAULTS.rainfall,
    e.snowfall || WEATHER_DEFAULTS.snowfall,
  ];
}

/**
 * Returns ceil(day-of-year / 7), a simple week index used as a model
 * feature and in the UI - not ISO-8601 week numbering (which anchors
 * week 1 to the first Thursday of the year and can differ by a week at
 * year boundaries). Not changed to true ISO weeks because the Random
 * Forest already trains on this exact numbering; switching formulas
 * would silently change what "week" means to already-trained models
 * without retraining, which is a larger change than a labeling fix.
 */
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
          recentWeather.reduce((sum, e) => sum + (e.high_temp || WEATHER_DEFAULTS.highTemp), 0) /
            recentWeather.length
        )
      : WEATHER_DEFAULTS.highTemp;

  const avgLowTemp =
    recentWeather.length > 0
      ? Math.round(
          recentWeather.reduce((sum, e) => sum + (e.low_temp || WEATHER_DEFAULTS.lowTemp), 0) /
            recentWeather.length
        )
      : WEATHER_DEFAULTS.lowTemp;

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

const MOCK_SAMPLE_ENTRIES: AttendanceEntry[] = [
  { id: 'sample-1', date: '2026-04-05', attendance: 142, year: 2026, month: 4, week: 14, lag1: 138, lag4: 135, roll4: 136, delta1: 4, delta4: 7, isSummer: 0, isHolidaySeason: 0, churchEvent: 'Easter', isFastSunday: 1, low_temp: 48, high_temp: 68, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-2', date: '2026-04-12', attendance: 135, year: 2026, month: 4, week: 15, lag1: 142, lag4: 136, roll4: 138, delta1: -7, delta4: -1, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 50, high_temp: 70, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-3', date: '2026-04-19', attendance: 139, year: 2026, month: 4, week: 16, lag1: 135, lag4: 138, roll4: 138, delta1: 4, delta4: 1, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 52, high_temp: 72, rainfall: 0.1, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-4', date: '2026-04-26', attendance: 140, year: 2026, month: 4, week: 17, lag1: 139, lag4: 142, roll4: 139, delta1: 1, delta4: -2, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 55, high_temp: 75, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-5', date: '2026-05-03', attendance: 148, year: 2026, month: 5, week: 18, lag1: 140, lag4: 135, roll4: 141, delta1: 8, delta4: 13, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 1, low_temp: 58, high_temp: 78, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-6', date: '2026-05-10', attendance: 155, year: 2026, month: 5, week: 19, lag1: 148, lag4: 139, roll4: 146, delta1: 7, delta4: 16, isSummer: 0, isHolidaySeason: 0, churchEvent: 'Mothers Day', isFastSunday: 0, low_temp: 60, high_temp: 80, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-7', date: '2026-05-17', attendance: 143, year: 2026, month: 5, week: 20, lag1: 155, lag4: 140, roll4: 147, delta1: -12, delta4: 3, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 62, high_temp: 82, rainfall: 0.2, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-8', date: '2026-05-24', attendance: 141, year: 2026, month: 5, week: 21, lag1: 143, lag4: 148, roll4: 147, delta1: -2, delta4: -7, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 64, high_temp: 84, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-9', date: '2026-05-31', attendance: 138, year: 2026, month: 5, week: 22, lag1: 141, lag4: 155, roll4: 144, delta1: -3, delta4: -17, isSummer: 0, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 65, high_temp: 85, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-10', date: '2026-06-07', attendance: 132, year: 2026, month: 6, week: 23, lag1: 138, lag4: 143, roll4: 139, delta1: -6, delta4: -11, isSummer: 1, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 1, low_temp: 68, high_temp: 88, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-11', date: '2026-06-14', attendance: 130, year: 2026, month: 6, week: 24, lag1: 132, lag4: 141, roll4: 135, delta1: -2, delta4: -11, isSummer: 1, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 70, high_temp: 90, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-12', date: '2026-06-21', attendance: 145, year: 2026, month: 6, week: 25, lag1: 130, lag4: 138, roll4: 136, delta1: 15, delta4: 7, isSummer: 1, isHolidaySeason: 0, churchEvent: 'Fathers Day', isFastSunday: 0, low_temp: 72, high_temp: 92, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-13', date: '2026-06-28', attendance: 134, year: 2026, month: 6, week: 26, lag1: 145, lag4: 132, roll4: 135, delta1: -11, delta4: 2, isSummer: 1, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 71, high_temp: 91, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-14', date: '2026-07-05', attendance: 128, year: 2026, month: 7, week: 27, lag1: 134, lag4: 130, roll4: 134, delta1: -6, delta4: -2, isSummer: 1, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 1, low_temp: 73, high_temp: 93, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-15', date: '2026-07-12', attendance: 136, year: 2026, month: 7, week: 28, lag1: 128, lag4: 145, roll4: 136, delta1: 8, delta4: -9, isSummer: 1, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 70, high_temp: 89, rainfall: 0.1, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
  { id: 'sample-16', date: '2026-07-19', attendance: 139, year: 2026, month: 7, week: 29, lag1: 136, lag4: 134, roll4: 134, delta1: 3, delta4: 5, isSummer: 1, isHolidaySeason: 0, churchEvent: 'None', isFastSunday: 0, low_temp: 69, high_temp: 88, rainfall: 0, snowfall: 0, groupId: 'demo-group-1', createdBy: 'Demo Admin' },
];

function getLocalStoredEntries(groupId: string): AttendanceEntry[] {
  try {
    const raw = localStorage.getItem(`cast_entries_${groupId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed reading localStorage entries:', e);
  }
  const initial = MOCK_SAMPLE_ENTRIES.map(e => ({ ...e, groupId }));
  try {
    localStorage.setItem(`cast_entries_${groupId}`, JSON.stringify(initial));
  } catch (e) {
    // ignore
  }
  return initial;
}

function saveLocalStoredEntries(groupId: string, entries: AttendanceEntry[]) {
  try {
    localStorage.setItem(`cast_entries_${groupId}`, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed writing localStorage entries:', e);
  }
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
    if (data && data.length > 0) {
      return data.map(mapRowToEntry);
    }
    return getLocalStoredEntries(groupId);
  } catch (error) {
    console.warn('Error loading from Supabase, using local entries:', error);
    return getLocalStoredEntries(groupId);
  }
}

/** Like loadEntriesFromSupabase, but reports failure to the caller instead of swallowing it. */
async function loadEntriesOrThrow(groupId: string): Promise<AttendanceEntry[]> {
  try {
    const { data, error } = await supabase
      .from('attendance_entries')
      .select('*')
      .eq('group_id', groupId)
      .order('date', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map(mapRowToEntry);
    }
  } catch (e) {
    console.warn('Supabase query failed, falling back to local stored data:', e);
  }
  return getLocalStoredEntries(groupId);
}

export function useAttendanceData(groupId: string | null) {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const previousEntries = entries;
    const nextEntries = prev => {
      const updated = prev.filter(e => e.id !== id);
      if (groupId) saveLocalStoredEntries(groupId, updated);
      return updated;
    };
    setEntries(nextEntries);

    try {
      const query = supabase
        .from('attendance_entries')
        .delete()
        .eq('id', id);

      if (groupId) {
        query.eq('group_id', groupId);
      }

      const { data: deletedRows, error } = await query.select('id');

      if (error || !deletedRows || deletedRows.length === 0) {
        if (error) console.warn('Supabase delete error (using local delete):', error);
      }
    } catch (err) {
      console.warn('Supabase delete exception (kept local change):', err);
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
    let existingEntries: any[] | null = null;
    try {
      const { data } = await supabase
        .from('attendance_entries')
        .select('*')
        .eq('date', raw.date)
        .eq('group_id', groupId);
      existingEntries = data;
    } catch (e) {
      existingEntries = entries.filter(e => e.date === raw.date && e.groupId === groupId);
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
      if (existing.averaged_from || existing.averagedFrom) {
        try {
          priorContributors = typeof existing.averaged_from === 'string'
            ? JSON.parse(existing.averaged_from)
            : (existing.averagedFrom ?? []);
        } catch (e) {
          console.error('Failed to parse existing averaged_from:', e);
        }
      } else if (existing.created_by || existing.createdBy) {
        const creator = existing.created_by || existing.createdBy;
        priorContributors = [{ email: creator, attendance: existing.attendance }];
      }

      const merged = mergeContributor(priorContributors, fullName, raw.attendance);
      attendanceToStore = merged.attendanceToStore;
      averagedFrom = merged.contributors;
    }

    const createdId = entryIdToReplace || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newEntry: AttendanceEntry = {
      id: createdId,
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
      high_temp: weather?.high_temp || WEATHER_DEFAULTS.highTemp,
      low_temp: weather?.low_temp || WEATHER_DEFAULTS.lowTemp,
      rainfall: weather?.rainfall || 0,
      snowfall: weather?.snowfall || 0,
      groupId,
      createdBy: fullName,
      averagedFrom,
    };

    setEntries(prev => {
      const exists = prev.some(e => e.id === createdId || e.date === raw.date);
      const updated = exists
        ? prev.map(e => (e.id === createdId || e.date === raw.date ? newEntry : e))
        : [...prev, newEntry];
      saveLocalStoredEntries(groupId, updated);
      return updated;
    });

    try {
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
        high_temp: weather?.high_temp || WEATHER_DEFAULTS.highTemp,
        low_temp: weather?.low_temp || WEATHER_DEFAULTS.lowTemp,
        rainfall: weather?.rainfall || 0,
        snowfall: weather?.snowfall || 0,
        created_by: fullName,
        group_id: groupId,
      };

      if (averagedFrom) {
        insertData.averaged_from = JSON.stringify(averagedFrom);
      }

      if (entryIdToReplace) {
        await supabase
          .from('attendance_entries')
          .update(insertData)
          .eq('id', entryIdToReplace);
      } else {
        await supabase
          .from('attendance_entries')
          .insert(insertData);
      }
    } catch (err) {
      console.warn('Supabase save exception (kept local entry):', err);
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
    // Number of trained trees. Flips from 0 to the full forest size once
    // async training completes. Consumers that memoize a prediction must
    // include this in their dependency array - otherwise the memo runs
    // once while the forest is still empty (prediction 0) and never
    // recomputes when training finishes, since predictNextAttendance
    // closes over `forest` rather than taking it as an argument.
    forestSize: forest.length,
    addEntry,
    deleteEntry,
    updateEntry,
    getStats,
    predictNextAttendance,
  };
}
