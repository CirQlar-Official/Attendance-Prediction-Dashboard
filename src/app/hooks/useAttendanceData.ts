import { useState, useEffect, useMemo } from 'react';
import {
  trainRandomForest,
  predictForest,
  featureImportances,
  type Forest,
  type RFResult,
} from '../utils/randomForest';
import { supabase } from '../../lib/supabase';
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
      return data.map((row: any) => ({
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
      }));
    }

    return [];
  } catch (error) {
    console.error('Error loading from Supabase:', error);
    return [];
  }
}

export function useAttendanceData(groupId: string | null) {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  loading;
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (!groupId) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const initialData = await loadEntriesFromSupabase(groupId);
      setEntries(initialData);
      setLoading(false);

      const channel = supabase
        .channel('attendance_entries_insert')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'attendance_entries',
          },
          (payload: any) => {
            const newEntry = payload.new as any;
            if (newEntry.group_id !== groupId) {
              return;
            }
            setEntries(prev => [
              ...prev,
              {
                id: newEntry.id,
                date: newEntry.date,
                attendance: newEntry.attendance,
                year: newEntry.year,
                month: newEntry.month,
                week: newEntry.week,
                lag1: newEntry.lag1,
                lag4: newEntry.lag4,
                roll4: newEntry.roll4,
                delta1: newEntry.delta1,
                delta4: newEntry.delta4,
                isSummer: newEntry.is_summer,
                isHolidaySeason: newEntry.is_holiday_season,
                churchEvent: newEntry.church_event,
                isFastSunday: newEntry.is_fast_sunday,
                low_temp: newEntry.low_temp,
                high_temp: newEntry.high_temp,
                rainfall: newEntry.rainfall,
                snowfall: newEntry.snowfall,
                groupId: newEntry.group_id,
              },
            ]);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    loadData();
  }, [groupId]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  const forest = useMemo<Forest>(() => {
    if (sorted.length < 5) return [];
    const X = sorted.map(e => toFeatureVector(e));
    const y = sorted.map(e => e.attendance);
    return trainRandomForest(X, y);
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
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...updates } : e)));
    const query = supabase
      .from('attendance_entries')
      .update({
        attendance: updates.attendance,
        church_event: updates.churchEvent,
        is_fast_sunday: updates.isFastSunday,
        is_summer: updates.isSummer,
        is_holiday_season: updates.isHolidaySeason,
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

    const { error } = await supabase
      .from('attendance_entries')
      .insert({
        date: raw.date,
        attendance: raw.attendance,
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
        created_by: user?.email,
        group_id: groupId,
      });

    if (error) {
      console.error('Error adding entry:', error);
      throw error;
    }
  };

  const bulkImportEntries = async (csvText: string) => {
    if (!groupId) {
      throw new Error('No group selected. Please join a group before importing CSV.');
    }

    const normalizeKey = (key: string) =>
      key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      throw new Error('CSV must contain a header row and at least one data row.');
    }

    const headers = lines[0].split(',').map(normalizeKey);
    const combinedHistory: AttendanceEntry[] = [...sorted];
    const parsedRows: any[] = [];

    for (const rowText of lines.slice(1)) {
      const values = rowText.split(',').map(value => value.trim());
      if (values.every(value => value === '')) continue;

      const record: Record<string, string> = {};
      headers.forEach((key, index) => {
        record[key] = values[index] ?? '';
      });

      const dateString = record.date || record['date'];
      if (!dateString) {
        throw new Error('CSV row missing a date value.');
      }

      const date = new Date(dateString + 'T12:00:00');
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date value in CSV: ${dateString}`);
      }

      const attendance = parseInt(record.attendance || '', 10);
      if (Number.isNaN(attendance)) {
        throw new Error(`Invalid attendance value for date ${dateString}.`);
      }

      const year = parseInt(record.year || '', 10) || date.getFullYear();
      const month = parseInt(record.month || '', 10) || date.getMonth() + 1;
      const week = parseInt(record.week || '', 10) || getWeekOfYear(date);
      const isSummer = record.is_summer || record.isSummer
        ? (parseInt(record.is_summer || record.isSummer || '0', 10) === 1 ? 1 : 0)
        : autoIsSummer(month);
      const isHolidaySeason = record.is_holiday_season || record.isHolidaySeason
        ? (parseInt(record.is_holiday_season || record.isHolidaySeason || '0', 10) === 1 ? 1 : 0)
        : autoIsHoliday(month);
      const churchEvent = (record.church_event || record.churchEvent || 'None') as ChurchEvent;
      const isFastSunday = record.is_fast_sunday || record.isFastSunday
        ? (parseInt(record.is_fast_sunday || record.isFastSunday || '0', 10) === 1 ? 1 : 0)
        : isFastSundayDate(date);

      const lag1 = record.lag1
        ? parseInt(record.lag1, 10)
        : combinedHistory.length >= 1
        ? combinedHistory[combinedHistory.length - 1].attendance
        : 0;
      const lag4 = record.lag4
        ? parseInt(record.lag4, 10)
        : combinedHistory.length >= 4
        ? combinedHistory[combinedHistory.length - 4].attendance
        : 0;

      const last4 = combinedHistory.slice(-4).map(e => e.attendance);
      const roll4 = record.roll4
        ? Number(record.roll4)
        : last4.length > 0
        ? Math.round((last4.reduce((sum, value) => sum + value, 0) / last4.length) * 100) / 100
        : 0;

      const lag2 = combinedHistory.length >= 2 ? combinedHistory[combinedHistory.length - 2].attendance : 0;
      const delta1 = record.delta1
        ? parseInt(record.delta1, 10)
        : lag1 - lag2;
      const delta4 = record.delta4
        ? parseInt(record.delta4, 10)
        : attendance - lag4;

      const low_temp = record.low_temp !== undefined && record.low_temp !== ''
        ? Number(record.low_temp)
        : record.lowTemp !== undefined && record.lowTemp !== ''
        ? Number(record.lowTemp)
        : undefined;
      const high_temp = record.high_temp !== undefined && record.high_temp !== ''
        ? Number(record.high_temp)
        : record.highTemp !== undefined && record.highTemp !== ''
        ? Number(record.highTemp)
        : undefined;
      const rainfall = record.rainfall !== undefined && record.rainfall !== ''
        ? Number(record.rainfall)
        : undefined;
      const snowfall = record.snowfall !== undefined && record.snowfall !== ''
        ? Number(record.snowfall)
        : undefined;

      const newRow = {
        date: dateString,
        attendance,
        year,
        month,
        week,
        lag1,
        lag4,
        roll4,
        delta1,
        delta4,
        is_summer: isSummer,
        is_holiday_season: isHolidaySeason,
        church_event: churchEvent,
        is_fast_sunday: isFastSunday,
        low_temp,
        high_temp,
        rainfall,
        snowfall,
        created_by: user?.email,
        group_id: groupId,
      };

      parsedRows.push(newRow);
      combinedHistory.push({
        id: `${dateString}-${attendance}`,
        date: dateString,
        attendance,
        year,
        month,
        week,
        lag1,
        lag4,
        roll4,
        delta1,
        delta4,
        isSummer,
        isHolidaySeason,
        churchEvent,
        isFastSunday,
        low_temp,
        high_temp,
        rainfall,
        snowfall,
        groupId,
      });
    }

    const duplicateDates = parsedRows
      .map(row => row.date)
      .filter((date, index, dates) => dates.indexOf(date) !== index);
    if (duplicateDates.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicateDates));
      throw new Error(
        `CSV contains duplicate date rows: ${uniqueDuplicates.join(', ')}`
      );
    }

    const { data: existingEntries, error: existingError } = await supabase
      .from('attendance_entries')
      .select('date')
      .eq('group_id', groupId);

    if (existingError) {
      console.error('Error checking existing dates for import:', existingError);
      throw existingError;
    }

    const existingDates = new Set(
      existingEntries?.map(entry => entry.date) ?? []
    );

    const conflictingDates = parsedRows
      .filter(row => existingDates.has(row.date))
      .map(row => row.date);

    const rowsToInsert = parsedRows.filter(row => !existingDates.has(row.date));

    if (conflictingDates.length > 0 && rowsToInsert.length === 0) {
      const uniqueConflicts = Array.from(new Set(conflictingDates));
      throw new Error(
        `All rows already exist: ${uniqueConflicts.join(', ')}`
      );
    }

    const chunkSize = 200;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('attendance_entries').insert(chunk);
      if (error) {
        console.error('Error importing CSV chunk:', error);
        throw error;
      }
    }

    const imported = await loadEntriesFromSupabase(groupId);
    setEntries(imported);
    const skipped = conflictingDates.length;
    const actuallyImported = rowsToInsert.length;
    if (skipped > 0) {
      console.warn(`Imported ${actuallyImported} rows (skipped ${skipped} duplicate dates)`);
    }
    return actuallyImported;
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
  addEntry, 
  bulkImportEntries,
  deleteEntry, 
  updateEntry, 
  getStats, 
  predictNextAttendance };
}
