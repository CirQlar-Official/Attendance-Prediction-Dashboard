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
}

export const CHURCH_EVENTS: ChurchEvent[] = [
  'None',
  'Easter',
  'Palm Sunday',
  'Mothers Day',
  'Fathers Day',
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
    'Palm Sunday': 2,
    'Mothers Day': 2,
    'Fathers Day': 2,
    Christmas: 3,
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

async function loadEntriesFromSupabase(): Promise<AttendanceEntry[]> {
  try {
    const { data, error } = await supabase
      .from('attendance_entries')
      .select('*')
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
      }));
    }

    return [];
  } catch (error) {
    console.error('Error loading from Supabase:', error);
    return [];
  }
}

export function useAttendanceData() {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      const initialData = await loadEntriesFromSupabase();
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
  }, []);

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
      });

    if (error) {
      console.error('Error adding entry:', error);
      throw error;
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
    entries,
    sorted,
    forest,
    addEntry,
    getStats,
    predictNextAttendance,
    computeLagFeatures,
    loading,
    user,
  };
}
