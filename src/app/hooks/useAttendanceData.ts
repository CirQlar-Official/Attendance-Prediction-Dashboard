import { useState, useEffect, useMemo } from 'react';
import {
  trainRandomForest,
  predictForest,
  featureImportances,
  type Forest,
  type RFResult,
} from '../utils/randomForest';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  date: string;       // YYYY-MM-DD
  attendance: number;
  year: number;
  month: number;
  week: number;       // ISO week of year
  // ── Automated lag/roll features ──
  lag1: number;
  lag4: number;
  roll4: number;
  delta1: number;
  delta4: number;
  // ── User-provided context ──
  isSummer: 0 | 1;
  isHolidaySeason: 0 | 1;
  churchEvent: ChurchEvent;
  isFastSunday: 0 | 1;
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
];

// ─── Church event encoding ────────────────────────────────────────────────────

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

// ─── Feature vector ───────────────────────────────────────────────────────────

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
  ];
}

// ─── Week of year helper ──────────────────────────────────────────────────────

export function getWeekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.ceil(dayOfYear / 7);
}

// ─── Auto-detect seasonal flags ───────────────────────────────────────────────

export function autoIsSummer(month: number): 0 | 1 {
  return month >= 6 && month <= 8 ? 1 : 0;
}

export function autoIsHoliday(month: number): 0 | 1 {
  return month >= 11 ? 1 : 0;
}

/** Is this date the first Sunday of its month? (Fast Sunday heuristic) */
export function isFastSundayDate(date: Date): 0 | 1 {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  // advance to first Sunday
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return d.getDate() === date.getDate() ? 1 : 0;
}

// ─── Lag / roll computation helpers ──────────────────────────────────────────

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

  // delta1 = lag1 - lag2  (last_att - second_to_last_att)
  const lag2 = n >= 2 ? sorted[n - 2].attendance : 0;
  const delta1 = lag1 - lag2;

  // delta4 = current_attendance - lag4  (as per CSV)
  const delta4 = newAttendance - lag4;

  return { lag1, lag4, roll4, delta1, delta4 };
}

/** Features for predicting NEXT week (attendance unknown → approximate delta4) */
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
  const delta4 = lag1 - lag4; // best approximation without knowing next attendance

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
  ];
}

// ─── Seed data from CASTA_data.csv ───────────────────────────────────────────

const SEED_DATA: AttendanceEntry[] = [
  { id:'s1',  date:'2024-01-07', attendance:158, year:2024, month:1,  week:1,  lag1:0,   lag4:0,   roll4:0,      delta1:0,    delta4:0,   isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:1 },
  { id:'s2',  date:'2024-01-21', attendance:143, year:2024, month:1,  week:4,  lag1:158, lag4:0,   roll4:0,      delta1:158,  delta4:0,   isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s3',  date:'2024-01-28', attendance:139, year:2024, month:1,  week:5,  lag1:143, lag4:0,   roll4:0,      delta1:-15,  delta4:0,   isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s4',  date:'2024-02-04', attendance:147, year:2024, month:2,  week:6,  lag1:139, lag4:0,   roll4:0,      delta1:-4,   delta4:0,   isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:1 },
  { id:'s5',  date:'2024-02-11', attendance:142, year:2024, month:2,  week:7,  lag1:147, lag4:158, roll4:146.75, delta1:8,    delta4:-16, isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s6',  date:'2024-02-18', attendance:139, year:2024, month:2,  week:8,  lag1:142, lag4:143, roll4:142.75, delta1:-5,   delta4:-4,  isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s7',  date:'2024-02-25', attendance:162, year:2024, month:2,  week:9,  lag1:139, lag4:139, roll4:141.75, delta1:-3,   delta4:23,  isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s8',  date:'2024-03-03', attendance:175, year:2024, month:3,  week:10, lag1:162, lag4:147, roll4:147.5,  delta1:23,   delta4:28,  isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:1 },
  { id:'s9',  date:'2024-03-10', attendance:153, year:2024, month:3,  week:11, lag1:175, lag4:142, roll4:154.5,  delta1:13,   delta4:11,  isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s10', date:'2024-03-17', attendance:149, year:2024, month:3,  week:12, lag1:153, lag4:139, roll4:157.25, delta1:-22,  delta4:10,  isSummer:0, isHolidaySeason:0, churchEvent:'None',       isFastSunday:0 },
  { id:'s11', date:'2024-03-24', attendance:158, year:2024, month:3,  week:13, lag1:149, lag4:162, roll4:159.75, delta1:-4,   delta4:-4,  isSummer:0, isHolidaySeason:0, churchEvent:'Palm Sunday', isFastSunday:0 },
  { id:'s12', date:'2024-03-31', attendance:171, year:2024, month:3,  week:14, lag1:158, lag4:175, roll4:158.75, delta1:9,    delta4:-4,  isSummer:0, isHolidaySeason:0, churchEvent:'Easter',      isFastSunday:0 },
  { id:'s13', date:'2024-04-14', attendance:147, year:2024, month:4,  week:16, lag1:171, lag4:153, roll4:157.75, delta1:13,   delta4:-6,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s14', date:'2024-04-21', attendance:175, year:2024, month:4,  week:17, lag1:147, lag4:149, roll4:156.25, delta1:-24,  delta4:26,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s15', date:'2024-04-28', attendance:163, year:2024, month:4,  week:18, lag1:175, lag4:158, roll4:162.75, delta1:28,   delta4:5,   isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s16', date:'2024-05-05', attendance:225, year:2024, month:5,  week:19, lag1:163, lag4:171, roll4:164,    delta1:-12,  delta4:54,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s17', date:'2024-05-12', attendance:164, year:2024, month:5,  week:20, lag1:225, lag4:147, roll4:177.5,  delta1:62,   delta4:17,  isSummer:0, isHolidaySeason:0, churchEvent:'Mothers Day', isFastSunday:0 },
  { id:'s18', date:'2024-06-09', attendance:147, year:2024, month:6,  week:24, lag1:164, lag4:175, roll4:181.75, delta1:-61,  delta4:-28, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s19', date:'2024-06-16', attendance:153, year:2024, month:6,  week:25, lag1:147, lag4:163, roll4:174.75, delta1:-17,  delta4:-10, isSummer:1, isHolidaySeason:0, churchEvent:'Fathers Day', isFastSunday:0 },
  { id:'s20', date:'2024-06-30', attendance:129, year:2024, month:6,  week:27, lag1:153, lag4:225, roll4:172.25, delta1:6,    delta4:-96, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s21', date:'2024-07-07', attendance:145, year:2024, month:7,  week:28, lag1:129, lag4:164, roll4:148.25, delta1:-24,  delta4:-19, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s22', date:'2024-07-14', attendance:158, year:2024, month:7,  week:29, lag1:145, lag4:147, roll4:143.5,  delta1:16,   delta4:11,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s23', date:'2024-07-21', attendance:156, year:2024, month:7,  week:30, lag1:158, lag4:153, roll4:146.25, delta1:13,   delta4:3,   isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s24', date:'2024-07-28', attendance:154, year:2024, month:7,  week:31, lag1:156, lag4:129, roll4:147,    delta1:-2,   delta4:25,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s25', date:'2024-08-04', attendance:169, year:2024, month:8,  week:32, lag1:154, lag4:145, roll4:153.25, delta1:-2,   delta4:24,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s26', date:'2024-08-11', attendance:158, year:2024, month:8,  week:33, lag1:169, lag4:158, roll4:159.25, delta1:15,   delta4:0,   isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s27', date:'2024-08-18', attendance:127, year:2024, month:8,  week:34, lag1:158, lag4:156, roll4:159.25, delta1:-11,  delta4:-29, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s28', date:'2024-08-25', attendance:123, year:2024, month:8,  week:35, lag1:127, lag4:154, roll4:152,    delta1:-31,  delta4:-31, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s29', date:'2024-09-01', attendance:138, year:2024, month:9,  week:36, lag1:123, lag4:169, roll4:144.25, delta1:-4,   delta4:-31, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s30', date:'2024-09-08', attendance:137, year:2024, month:9,  week:37, lag1:138, lag4:158, roll4:136.5,  delta1:15,   delta4:-21, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s31', date:'2024-09-15', attendance:146, year:2024, month:9,  week:38, lag1:137, lag4:127, roll4:131.25, delta1:-1,   delta4:19,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s32', date:'2024-09-22', attendance:153, year:2024, month:9,  week:39, lag1:146, lag4:123, roll4:136,    delta1:9,    delta4:30,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s33', date:'2024-09-29', attendance:200, year:2024, month:9,  week:40, lag1:153, lag4:138, roll4:143.5,  delta1:7,    delta4:62,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s34', date:'2024-10-13', attendance:154, year:2024, month:10, week:42, lag1:200, lag4:137, roll4:159,    delta1:47,   delta4:17,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s35', date:'2024-10-20', attendance:155, year:2024, month:10, week:43, lag1:154, lag4:146, roll4:163.25, delta1:-46,  delta4:9,   isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s36', date:'2024-10-27', attendance:174, year:2024, month:10, week:44, lag1:155, lag4:153, roll4:165.5,  delta1:1,    delta4:21,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s37', date:'2024-11-03', attendance:160, year:2024, month:11, week:45, lag1:174, lag4:200, roll4:170.75, delta1:19,   delta4:-40, isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:1 },
  { id:'s38', date:'2024-11-17', attendance:137, year:2024, month:11, week:47, lag1:160, lag4:154, roll4:160.75, delta1:-14,  delta4:-17, isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:0 },
  { id:'s39', date:'2024-11-24', attendance:175, year:2024, month:11, week:48, lag1:137, lag4:155, roll4:156.5,  delta1:-23,  delta4:20,  isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:0 },
  { id:'s40', date:'2024-12-01', attendance:158, year:2024, month:12, week:49, lag1:175, lag4:174, roll4:161.5,  delta1:38,   delta4:-16, isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:1 },
  { id:'s41', date:'2024-12-08', attendance:143, year:2024, month:12, week:50, lag1:158, lag4:160, roll4:157.5,  delta1:-17,  delta4:-17, isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:0 },
  { id:'s42', date:'2024-12-15', attendance:128, year:2024, month:12, week:51, lag1:143, lag4:137, roll4:153.25, delta1:-15,  delta4:-9,  isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:0 },
  { id:'s43', date:'2024-12-22', attendance:180, year:2024, month:12, week:52, lag1:128, lag4:175, roll4:151,    delta1:-15,  delta4:5,   isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:0 },
  { id:'s44', date:'2024-12-29', attendance:154, year:2024, month:12, week:53, lag1:180, lag4:158, roll4:152.25, delta1:52,   delta4:-4,  isSummer:0, isHolidaySeason:1, churchEvent:'None',        isFastSunday:0 },
  { id:'s45', date:'2025-01-12', attendance:173, year:2025, month:1,  week:3,  lag1:154, lag4:143, roll4:151.25, delta1:-26,  delta4:30,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s46', date:'2025-01-19', attendance:161, year:2025, month:1,  week:4,  lag1:173, lag4:128, roll4:158.75, delta1:19,   delta4:33,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s47', date:'2025-01-26', attendance:167, year:2025, month:1,  week:5,  lag1:161, lag4:180, roll4:167,    delta1:-12,  delta4:-13, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s48', date:'2025-02-02', attendance:185, year:2025, month:2,  week:6,  lag1:167, lag4:154, roll4:163.75, delta1:6,    delta4:31,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s49', date:'2025-02-09', attendance:158, year:2025, month:2,  week:7,  lag1:185, lag4:173, roll4:171.5,  delta1:18,   delta4:-15, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s50', date:'2025-02-23', attendance:218, year:2025, month:2,  week:9,  lag1:158, lag4:161, roll4:167.75, delta1:-27,  delta4:57,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s51', date:'2025-03-02', attendance:149, year:2025, month:3,  week:10, lag1:218, lag4:167, roll4:182,    delta1:60,   delta4:-18, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s52', date:'2025-03-09', attendance:150, year:2025, month:3,  week:11, lag1:149, lag4:185, roll4:177.5,  delta1:-69,  delta4:-35, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s53', date:'2025-03-16', attendance:153, year:2025, month:3,  week:12, lag1:150, lag4:158, roll4:168.75, delta1:1,    delta4:-5,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s54', date:'2025-03-23', attendance:163, year:2025, month:3,  week:13, lag1:153, lag4:218, roll4:167.5,  delta1:3,    delta4:-55, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s55', date:'2025-03-30', attendance:162, year:2025, month:3,  week:14, lag1:163, lag4:149, roll4:153.75, delta1:10,   delta4:13,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s56', date:'2025-04-13', attendance:175, year:2025, month:4,  week:16, lag1:162, lag4:150, roll4:157,    delta1:-1,   delta4:25,  isSummer:0, isHolidaySeason:0, churchEvent:'Palm Sunday', isFastSunday:0 },
  { id:'s57', date:'2025-04-20', attendance:202, year:2025, month:4,  week:17, lag1:175, lag4:153, roll4:163.25, delta1:13,   delta4:49,  isSummer:0, isHolidaySeason:0, churchEvent:'Easter',      isFastSunday:0 },
  { id:'s58', date:'2025-04-27', attendance:179, year:2025, month:4,  week:18, lag1:202, lag4:163, roll4:175.5,  delta1:27,   delta4:16,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s59', date:'2025-05-04', attendance:162, year:2025, month:5,  week:19, lag1:179, lag4:162, roll4:179.5,  delta1:-23,  delta4:0,   isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s60', date:'2025-05-11', attendance:155, year:2025, month:5,  week:20, lag1:162, lag4:175, roll4:179.5,  delta1:-17,  delta4:-20, isSummer:0, isHolidaySeason:0, churchEvent:'Mothers Day', isFastSunday:0 },
  { id:'s61', date:'2025-05-25', attendance:156, year:2025, month:5,  week:22, lag1:155, lag4:202, roll4:174.5,  delta1:-7,   delta4:-46, isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s62', date:'2025-06-01', attendance:141, year:2025, month:6,  week:23, lag1:156, lag4:179, roll4:163,    delta1:1,    delta4:-38, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s63', date:'2025-06-08', attendance:151, year:2025, month:6,  week:24, lag1:141, lag4:162, roll4:153.5,  delta1:-15,  delta4:-11, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s64', date:'2025-06-15', attendance:173, year:2025, month:6,  week:25, lag1:151, lag4:155, roll4:150.75, delta1:10,   delta4:18,  isSummer:1, isHolidaySeason:0, churchEvent:'Fathers Day', isFastSunday:0 },
  { id:'s65', date:'2025-06-22', attendance:138, year:2025, month:6,  week:26, lag1:173, lag4:156, roll4:155.25, delta1:22,   delta4:-18, isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s66', date:'2025-06-29', attendance:144, year:2025, month:6,  week:27, lag1:138, lag4:141, roll4:150.75, delta1:-35,  delta4:3,   isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s67', date:'2025-07-06', attendance:145, year:2025, month:7,  week:28, lag1:144, lag4:151, roll4:151.5,  delta1:6,    delta4:-6,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s68', date:'2025-07-13', attendance:170, year:2025, month:7,  week:29, lag1:145, lag4:173, roll4:150,    delta1:1,    delta4:-3,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s69', date:'2025-07-20', attendance:148, year:2025, month:7,  week:30, lag1:170, lag4:138, roll4:149.25, delta1:25,   delta4:10,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s70', date:'2025-07-27', attendance:146, year:2025, month:7,  week:31, lag1:148, lag4:144, roll4:151.75, delta1:-22,  delta4:2,   isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s71', date:'2025-08-03', attendance:170, year:2025, month:8,  week:32, lag1:146, lag4:145, roll4:152.25, delta1:-2,   delta4:25,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
  { id:'s72', date:'2025-08-10', attendance:176, year:2025, month:8,  week:33, lag1:170, lag4:170, roll4:158.5,  delta1:24,   delta4:6,   isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s73', date:'2025-08-17', attendance:170, year:2025, month:8,  week:34, lag1:176, lag4:148, roll4:160,    delta1:6,    delta4:22,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s74', date:'2025-08-24', attendance:173, year:2025, month:8,  week:35, lag1:170, lag4:146, roll4:165.5,  delta1:-6,   delta4:27,  isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s75', date:'2025-08-31', attendance:173, year:2025, month:8,  week:36, lag1:173, lag4:170, roll4:172.25, delta1:3,    delta4:3,   isSummer:1, isHolidaySeason:0, churchEvent:'None',        isFastSunday:0 },
  { id:'s76', date:'2025-09-07', attendance:187, year:2025, month:9,  week:37, lag1:173, lag4:176, roll4:173,    delta1:0,    delta4:11,  isSummer:0, isHolidaySeason:0, churchEvent:'None',        isFastSunday:1 },
];

// ─── Storage ──────────────────────────────────────────────────────────────────

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
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error loading from Supabase:', error);
    return [];
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAttendanceData() {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Load initial data and setup real-time listener
  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      const initialData = await loadEntriesFromSupabase();
      setEntries(initialData);
      setLoading(false);

      // Subscribe to real-time changes
      const subscription = supabase
        .from('attendance_entries')
        .on('*', (payload) => {
          if (payload.eventType === 'INSERT') {
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
              },
            ]);
          }
        })
        .subscribe();

      return () => {
        supabase.removeSubscription(subscription);
      };
    };

    loadData();
  }, []);

  // Sort chronologically (memoised)
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  // ── Trained Random Forest (only re-trains when entries change) ──────────────
  const forest = useMemo<Forest>(() => {
    if (sorted.length < 5) return [];
    const X = sorted.map(e => toFeatureVector(e));
    const y = sorted.map(e => e.attendance);
    return trainRandomForest(X, y);
  }, [sorted]);

  // ── Add entry ───────────────────────────────────────────────────────────────
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

    // Insert into Supabase
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
        created_by: user?.email,
      });

    if (error) {
      console.error('Error adding entry:', error);
      throw error;
    }

    // Data will be updated via the real-time subscription
  };

  // ── Stats for Dashboard ─────────────────────────────────────────────────────
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
        ? Math.round(
            thisMonth.reduce((s, e) => s + e.attendance, 0) / thisMonth.length
          )
        : 0;

    const thisYear = sorted.filter(
      e => new Date(e.date + 'T12:00:00').getFullYear() === now.getFullYear()
    );
    const ytdAvg =
      thisYear.length > 0
        ? Math.round(
            thisYear.reduce((s, e) => s + e.attendance, 0) / thisYear.length
          )
        : 0;

    return {
      current: mostRecent.attendance,
      lastWeek: lastWeek?.attendance ?? 0,
      monthAvg,
      ytdAvg,
    };
  };

  // ── RF Prediction ───────────────────────────────────────────────────────────
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
