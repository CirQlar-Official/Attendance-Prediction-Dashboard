import { describe, it, expect } from 'vitest';
import {
  autoIsSummer,
  autoIsHoliday,
  isFastSundayDate,
  getWeekOfYear,
  computeLagFeatures,
  computeNextWeekFeatures,
  toFeatureVector,
  type AttendanceEntry,
} from '../useAttendanceData';

function makeEntry(overrides: Partial<AttendanceEntry> & { attendance: number }): AttendanceEntry {
  return {
    id: 'test-id',
    date: '2026-01-04',
    year: 2026,
    month: 1,
    week: 1,
    lag1: 0,
    lag4: 0,
    roll4: 0,
    delta1: 0,
    delta4: 0,
    isSummer: 0,
    isHolidaySeason: 0,
    churchEvent: 'None',
    isFastSunday: 0,
    groupId: 'group-1',
    ...overrides,
  };
}

describe('autoIsSummer', () => {
  it('flags June through August as summer', () => {
    expect(autoIsSummer(6)).toBe(1);
    expect(autoIsSummer(7)).toBe(1);
    expect(autoIsSummer(8)).toBe(1);
  });

  it('does not flag months outside June-August', () => {
    expect(autoIsSummer(5)).toBe(0);
    expect(autoIsSummer(9)).toBe(0);
    expect(autoIsSummer(1)).toBe(0);
  });
});

describe('autoIsHoliday', () => {
  it('flags November and December as holiday season', () => {
    expect(autoIsHoliday(11)).toBe(1);
    expect(autoIsHoliday(12)).toBe(1);
  });

  it('does not flag other months', () => {
    expect(autoIsHoliday(10)).toBe(0);
    expect(autoIsHoliday(1)).toBe(0);
  });
});

describe('isFastSundayDate', () => {
  it('flags the first Sunday of the month', () => {
    // March 2026: March 1 is a Sunday.
    expect(isFastSundayDate(new Date(2026, 2, 1))).toBe(1);
  });

  it('does not flag other Sundays in the month', () => {
    // March 8, 2026 is the second Sunday.
    expect(isFastSundayDate(new Date(2026, 2, 8))).toBe(0);
  });
});

describe('getWeekOfYear', () => {
  it('returns 1 for January 1st', () => {
    expect(getWeekOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it('increases with the day of year', () => {
    const week1 = getWeekOfYear(new Date(2026, 0, 1));
    const week10 = getWeekOfYear(new Date(2026, 2, 1));
    expect(week10).toBeGreaterThan(week1);
  });
});

describe('computeLagFeatures', () => {
  it('returns zeros when there is no history', () => {
    const result = computeLagFeatures([], 100);
    expect(result).toEqual({ lag1: 0, lag4: 0, roll4: 0, delta1: 0, delta4: 100 });
  });

  it('computes lag1/lag2/delta1 from the most recent two entries', () => {
    const sorted = [
      makeEntry({ attendance: 90, date: '2026-01-04' }),
      makeEntry({ attendance: 100, date: '2026-01-11' }),
    ];
    const result = computeLagFeatures(sorted, 110);
    expect(result.lag1).toBe(100);
    expect(result.delta1).toBe(100 - 90); // lag1 - lag2
  });

  it('computes lag4 and delta4 only once 4+ entries exist', () => {
    const sorted = [80, 85, 90, 95].map((attendance, i) =>
      makeEntry({ attendance, date: `2026-01-0${i + 4}` })
    );
    const result = computeLagFeatures(sorted, 100);
    expect(result.lag4).toBe(80); // 4th-from-last entry
    expect(result.delta4).toBe(100 - 80); // newAttendance - lag4
  });

  it('computes roll4 as the average of the last 4 entries, rounded to 2 decimals', () => {
    const sorted = [80, 85, 90, 95].map((attendance, i) =>
      makeEntry({ attendance, date: `2026-01-0${i + 4}` })
    );
    const result = computeLagFeatures(sorted, 100);
    expect(result.roll4).toBe(87.5);
  });
});

describe('computeNextWeekFeatures', () => {
  const context = {
    isSummer: 0 as const,
    isHolidaySeason: 0 as const,
    churchEvent: 'None' as const,
    isFastSunday: 0 as const,
    month: 3,
    week: 10,
  };

  it('falls back to weather defaults when history has no weather data', () => {
    const sorted = [makeEntry({ attendance: 100 })];
    const vec = computeNextWeekFeatures(sorted, context);
    // indices 11/12 are avgHighTemp/avgLowTemp per FEATURE_NAMES ordering
    expect(vec[11]).toBe(65);
    expect(vec[12]).toBe(55);
  });

  it('averages weather across the last 4 entries when present', () => {
    const sorted = [
      makeEntry({ attendance: 100, high_temp: 70, low_temp: 50 }),
      makeEntry({ attendance: 100, high_temp: 80, low_temp: 60 }),
    ];
    const vec = computeNextWeekFeatures(sorted, context);
    expect(vec[11]).toBe(75); // avg high
    expect(vec[12]).toBe(55); // avg low
  });

  it('produces a vector matching toFeatureVector length', () => {
    const entry = makeEntry({ attendance: 100 });
    const vec = computeNextWeekFeatures([entry], context);
    const staticVec = toFeatureVector(entry);
    expect(vec.length).toBe(staticVec.length);
  });
});

describe('toFeatureVector', () => {
  it('applies weather defaults when fields are undefined', () => {
    const entry = makeEntry({ attendance: 100 });
    const vec = toFeatureVector(entry);
    expect(vec[11]).toBe(65); // high_temp default
    expect(vec[12]).toBe(55); // low_temp default
    expect(vec[13]).toBe(0); // rainfall default
    expect(vec[14]).toBe(0); // snowfall default
  });

  it('uses actual weather values when present', () => {
    const entry = makeEntry({ attendance: 100, high_temp: 72, low_temp: 58, rainfall: 1.2, snowfall: 0 });
    const vec = toFeatureVector(entry);
    expect(vec[11]).toBe(72);
    expect(vec[12]).toBe(58);
    expect(vec[13]).toBe(1.2);
  });
});
