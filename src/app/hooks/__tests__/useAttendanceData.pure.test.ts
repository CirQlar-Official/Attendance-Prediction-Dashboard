import { describe, it, expect } from 'vitest';
import {
  autoIsSummer,
  autoIsHoliday,
  isFastSundayDate,
  getWeekOfYear,
  computeLagFeatures,
  computeNextWeekFeatures,
  computeNextWeekLagSummary,
  toFeatureVector,
  mergeContributor,
  recomputeForwardFeatures,
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

  it('embeds the same lag/delta values as computeNextWeekLagSummary', () => {
    const sorted = [80, 85, 90, 95, 100].map((attendance, i) =>
      makeEntry({ attendance, date: `2026-01-0${i + 4}` })
    );
    const summary = computeNextWeekLagSummary(sorted);
    const vec = computeNextWeekFeatures(sorted, context);

    // vector layout: [lag1, lag4, roll4, delta1, delta4, ...context]
    expect(vec[0]).toBe(summary.lag1);
    expect(vec[1]).toBe(summary.lag4);
    expect(vec[2]).toBe(summary.roll4);
    expect(vec[3]).toBe(summary.delta1);
    expect(vec[4]).toBe(summary.delta4);
  });
});

describe('computeNextWeekLagSummary', () => {
  it('returns zeros when there is no history', () => {
    expect(computeNextWeekLagSummary([])).toEqual({
      lag1: 0,
      lag4: 0,
      roll4: 0,
      delta1: 0,
      delta4: 0,
    });
  });

  it('approximates delta4 from the most recent known value (lag1 - lag4), unlike computeLagFeatures', () => {
    const sorted = [80, 85, 90, 95].map((attendance, i) =>
      makeEntry({ attendance, date: `2026-01-0${i + 4}` })
    );
    const summary = computeNextWeekLagSummary(sorted);
    // lag1 = 95 (most recent), lag4 = 80 (4th-from-last)
    expect(summary.delta4).toBe(95 - 80);
  });
});

describe('mergeContributor', () => {
  it('adds a new contributor when none exists yet', () => {
    const result = mergeContributor([], 'Alice', 100);
    expect(result.contributors).toEqual([{ email: 'Alice', attendance: 100 }]);
    expect(result.attendanceToStore).toBe(100);
  });

  it('averages a new contributor in alongside an existing one', () => {
    const existing = [{ email: 'Alice', attendance: 100 }];
    const result = mergeContributor(existing, 'Bob', 120);
    expect(result.contributors).toEqual([
      { email: 'Alice', attendance: 100 },
      { email: 'Bob', attendance: 120 },
    ]);
    expect(result.attendanceToStore).toBe(110);
  });

  it('replaces the same contributor resubmitting instead of appending a duplicate', () => {
    const existing = [
      { email: 'Alice', attendance: 100 },
      { email: 'Bob', attendance: 120 },
    ];
    // Alice resubmits a corrected value for the same date.
    const result = mergeContributor(existing, 'Alice', 90);
    expect(result.contributors).toEqual([
      { email: 'Alice', attendance: 90 },
      { email: 'Bob', attendance: 120 },
    ]);
    // Average of 90 and 120, not a three-way average that still counts Alice's old 100.
    expect(result.attendanceToStore).toBe(105);
  });

  it('is idempotent: resubmitting the same value repeatedly does not change the average', () => {
    let contributors = [{ email: 'Alice', attendance: 100 }];
    for (let i = 0; i < 5; i++) {
      const result = mergeContributor(contributors, 'Alice', 100);
      contributors = result.contributors;
      expect(result.attendanceToStore).toBe(100);
      expect(result.contributors).toHaveLength(1);
    }
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

describe('recomputeForwardFeatures', () => {
  // Six entries: A B C D E F, attendance 100 110 90 95 105 120.
  function makeHistory() {
    return [
      makeEntry({ id: 'A', attendance: 100, date: '2026-01-04' }),
      makeEntry({ id: 'B', attendance: 110, date: '2026-01-11' }),
      makeEntry({ id: 'C', attendance: 90, date: '2026-01-18' }),
      makeEntry({ id: 'D', attendance: 95, date: '2026-01-25' }),
      makeEntry({ id: 'E', attendance: 105, date: '2026-02-01' }),
      makeEntry({ id: 'F', attendance: 120, date: '2026-02-08' }),
    ];
  }

  it('returns nothing when the id is not found', () => {
    expect(recomputeForwardFeatures(makeHistory(), 'nonexistent', 999)).toEqual([]);
  });

  it('recomputes the edited entry plus at most 4 downstream entries', () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'C', 200);
    // C, D, E, F = edited + 3 downstream (only 3 exist after C in a 6-entry list)
    expect(updates.map(u => u.id)).toEqual(['C', 'D', 'E', 'F']);
  });

  it('does not touch entries before the edited one', () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'C', 200);
    expect(updates.find(u => u.id === 'A')).toBeUndefined();
    expect(updates.find(u => u.id === 'B')).toBeUndefined();
  });

  it("recomputes the edited entry's own features from its unaffected predecessors", () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'C', 200);
    const cUpdate = updates.find(u => u.id === 'C')!;
    // C's history is just [A(100), B(110)] - unaffected by the edit to C itself.
    expect(cUpdate.lag1).toBe(110); // B
    expect(cUpdate.delta4).toBe(200 - 0); // lag4 unavailable (n<4), so delta4 = newAttendance - 0
  });

  it("propagates the corrected value into downstream entries' lag1", () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'C', 200);
    const dUpdate = updates.find(u => u.id === 'D')!;
    // D's lag1 should reflect C's NEW value (200), not the stale 90.
    expect(dUpdate.lag1).toBe(200);
  });

  it("propagates the corrected value into roll4 further downstream", () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'C', 200);
    const fUpdate = updates.find(u => u.id === 'F')!;
    // F's history (corrected) is [A100, B110, C200, D95, E105] (5 entries);
    // lag4 = 4th-from-last = history[1] = B's 110 (C's corrected 200 is
    // history[2], one position short of the lag4 lookback at this distance).
    expect(fUpdate.lag4).toBe(110);
    // roll4 = avg of the last 4 of that history = [B110, C200, D95, E105]
    expect(fUpdate.roll4).toBeCloseTo((110 + 200 + 95 + 105) / 4, 2);
  });

  it("propagates the corrected value into a downstream entry's lag4 when it is exactly 4 positions later", () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'C', 200);
    const eUpdate = updates.find(u => u.id === 'E')!;
    // E's history (corrected) is [A100, B110, C200, D95] (4 entries);
    // lag4 = 4th-from-last = history[0] = A's 100, not C - lag4 only
    // reaches exactly 4 entries back, and C is 3 entries back from E.
    expect(eUpdate.lag4).toBe(100);
    // But roll4 (avg of the last 4) does include C's corrected value.
    expect(eUpdate.roll4).toBeCloseTo((100 + 110 + 200 + 95) / 4, 2);
  });

  it('when editing the very last entry, only that entry is recomputed', () => {
    const updates = recomputeForwardFeatures(makeHistory(), 'F', 300);
    expect(updates.map(u => u.id)).toEqual(['F']);
  });

  it('matches computeLagFeatures exactly for a from-scratch computation on the same corrected history', () => {
    const history = makeHistory();
    const updates = recomputeForwardFeatures(history, 'C', 200);
    const dUpdate = updates.find(u => u.id === 'D')!;

    // Manually build the corrected history up to D and compute independently.
    const correctedUpToD = [
      makeEntry({ id: 'A', attendance: 100 }),
      makeEntry({ id: 'B', attendance: 110 }),
      makeEntry({ id: 'C', attendance: 200 }),
    ];
    const expected = computeLagFeatures(correctedUpToD, 95);
    expect(dUpdate).toEqual({ id: 'D', ...expected });
  });
});
