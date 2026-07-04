
import { useState, useMemo } from 'react';
import { useAttendanceData, type Group } from '../hooks/useAttendanceData';
import { useDarkMode } from '../context/DarkModeContext';
import { useOutletContext } from 'react-router';
import {
  CHURCH_EVENTS,
  autoIsSummer,
  autoIsHoliday,
  isFastSundayDate,
  getWeekOfYear,
  type ChurchEvent,
} from '../hooks/useAttendanceData';
import { format, nextSunday as getNextSunday } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  BarChart2,
  Moon,
  Sun,
  Check,
  X,
  ThermometerSun,
  ThermometerSnowflake,
  Droplets,
  Snowflake,
  Sparkles,
  Radar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export function Forecast() {
  const { selectedGroup } = useOutletContext<{ selectedGroup: Group | null }>();
  const { sorted, predictNextAttendance } = useAttendanceData(selectedGroup?.id ?? null);
  const { darkMode, setDarkMode } = useDarkMode();

  // ── Always calculate from TODAY ──────────────────────────────────────────────
  const nextSunday = useMemo(() => {
    const today = new Date();
    // On Sunday, predict TODAY; Monday-Saturday, predict next Sunday
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
      // If today is Sunday, predict for today
      return today;
    } else {
      // Get next Sunday from today
      return getNextSunday(today);
    }
  }, []);

  const nextMonth = nextSunday.getMonth() + 1;
  const nextWeek = getWeekOfYear(nextSunday);

  // ── User state (toggleable) ───────────────────────────────────────────────────
  const [isSummer, setIsSummer] = useState<0 | 1>(autoIsSummer(nextMonth));
  const [isHolidaySeason, setIsHolidaySeason] = useState<0 | 1>(
    autoIsHoliday(nextMonth)
  );
  const [churchEvent, setChurchEvent] = useState<ChurchEvent>('None');
  const [isFastSunday, setIsFastSunday] = useState<0 | 1>(
    isFastSundayDate(nextSunday)
  );

  // ── Run RF prediction ────────────────────────────────────────────────────────
  const result = useMemo(
    () =>
      predictNextAttendance({
        isSummer,
        isHolidaySeason,
        churchEvent,
        isFastSunday,
        month: nextMonth,
        week: nextWeek,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSummer, isHolidaySeason, churchEvent, isFastSunday, sorted.length]
  );

  const { prediction, std, confidence, featureImps } = result;

  // ── Derive trend vs most-recent actual ──────────────────────────────────────
  const lastActual =
    sorted.length > 0 ? sorted[sorted.length - 1].attendance : 0;
  const diff = prediction - lastActual;
  const pctChange = lastActual > 0 ? ((diff / lastActual) * 100).toFixed(1) : '0';

  const confidenceColor =
    confidence === 'high'
      ? '#14ae5c'
      : confidence === 'medium'
      ? '#029eff'
      : '#ff9500';

  const confidenceLabel =
    confidence === 'high'
      ? 'High Confidence'
      : confidence === 'medium'
      ? 'Medium Confidence'
      : 'Low Confidence';

  // Top 5 importances for bar chart
  const topImps = [...featureImps]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6);

  const recentEntries = [...sorted].reverse().slice(0, 5);

  return (
    <div className={`min-h-full w-full overflow-auto px-3 py-3 pb-24 sm:px-4 sm:py-4 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className={`app-shell-card-strong overflow-hidden p-4 sm:p-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <Sparkles className="size-3.5" />
                Forecast
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">Attendance forecast</p>
                <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${darkMode ? 'border-cyan-900/60 bg-cyan-950/50 text-cyan-300' : 'border-cyan-200 bg-cyan-50 text-cyan-700'}`}>Predicting {format(nextSunday, 'MMM d')}</div>
              <button onClick={() => setDarkMode(!darkMode)} className={`rounded-2xl p-2.5 transition ${darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 p-6 text-white shadow-[0_25px_70px_-30px_rgba(37,99,235,0.65)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-50/80">RF model prediction</p>
              <p className="mt-3 text-5xl font-semibold sm:text-6xl">{prediction}</p>
              <p className="mt-2 text-sm text-blue-50/90">± {std} range across {result.treePredictions.length} trees</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Radar className="size-6" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 ">
            <p className="text-sm font-semibold bg-white h-fit py-2 px-4 rounded-full" style={{ color: confidenceColor }}>{confidenceLabel}</p>
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-sm backdrop-blur">
              {diff > 0 ? <ChevronUp className="size-4" /> : diff < 0 ? <ChevronDown className="size-4" /> : <Minus className="size-4" />}
              <span>{diff > 0 ? '+' : ''}{diff} ({pctChange}%) vs last week</span>
            </div>
          </div>
        </div>

        <div className={`app-shell-card p-4 sm:p-5`}>
          <div className="mb-4">
            <p className="app-section-label">Context</p>
            <h2 className="mt-1 text-lg font-semibold">Adjust next-week context</h2>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold">Church event</label>
            <select value={churchEvent} onChange={e => setChurchEvent(e.target.value as ChurchEvent)} className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
              {CHURCH_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Fast Sunday', value: isFastSunday, set: setIsFastSunday },
              { label: 'Summer', value: isSummer, set: setIsSummer },
              { label: 'Holiday', value: isHolidaySeason, set: setIsHolidaySeason },
            ].map(({ label, value, set }) => (
              <button key={label} onClick={() => set(value === 1 ? 0 : 1)} className={`flex flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition ${value === 1 ? (darkMode ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-blue-200 bg-blue-50 text-blue-700') : (darkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-slate-200 bg-white text-slate-600')}`}>
                <p className="text-sm font-semibold">{label}</p>
                {value === 1 ? <Check className="mt-1 size-4" /> : <X className="mt-1 size-4" />}
              </button>
            ))}
          </div>
        </div>

        {topImps.length > 0 && (
          <div className={`app-shell-card p-4 sm:p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <BarChart2 className={`size-4 ${darkMode ? 'text-cyan-300' : 'text-blue-600'}`} />
              <div>
                <p className="app-section-label">Model</p>
                <h2 className="mt-1 text-lg font-semibold">Feature importances</h2>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={topImps}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={darkMode ? '#444' : '#eceef2'} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: darkMode ? '#999' : '#4c4c4c' }}
                  tickFormatter={v => `${v}%`}
                  stroke={darkMode ? '#444' : '#eceef2'}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 10, fill: darkMode ? '#999' : '#4c4c4c' }}
                  stroke="none"
                />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, 'Importance']}
                  contentStyle={{
                    backgroundColor: darkMode ? '#333' : '#fff',
                    color: darkMode ? '#fff' : '#000',
                    border: `1px solid ${darkMode ? '#555' : '#eceef2'}`,
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="importance" fill={darkMode ? '#029eff' : '#000124'} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className={`mt-2 text-center text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Weighted split-frequency across {result.treePredictions.length} RF trees</p>
          </div>
        )}

        <div className={`app-shell-card p-4 sm:p-5`}>
          <div className="mb-4">
            <p className="app-section-label">Inputs</p>
            <h2 className="mt-1 text-lg font-semibold">Model inputs for next week</h2>
          </div>
          {sorted.length >= 1 && (() => {
            const n = sorted.length;
            const lag1 = sorted[n - 1].attendance;
            const lag4 = n >= 4 ? sorted[n - 4].attendance : 0;
            const last4 = sorted.slice(-4).map(e => e.attendance);
            const roll4 = last4.length
              ? Math.round(last4.reduce((a, b) => a + b, 0) / last4.length)
              : 0;
            const lag2 = n >= 2 ? sorted[n - 2].attendance : 0;
            const delta1 = lag1 - lag2;
            const delta4approx = lag1 - lag4;

            const rows = [
              { label: 'Lag 1 (last week)', value: lag1 },
              { label: 'Lag 4 (4 weeks ago)', value: lag4 },
              { label: 'Roll 4 (4-week avg)', value: roll4 },
              { label: 'Delta 1 (lag1 − lag2)', value: delta1, signed: true },
              { label: 'Delta 4 approx (lag1 − lag4)', value: delta4approx, signed: true },
              { label: 'Month', value: nextMonth },
              { label: 'Week of Year', value: nextWeek },
            ];

            return rows.map(({ label, value, signed }) => (
              <div key={label} className={`flex items-center justify-between rounded-2xl px-3 py-3 ${darkMode ? 'bg-slate-900/60' : 'bg-slate-50/70'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
                <p
                  className={`font-['Segoe_UI'] text-[13px] ${
                    darkMode && !signed ? 'text-white' : !darkMode && !signed ? 'text-black' : ''
                  }`}
                  style={
                    signed
                      ? { color: value > 0 ? '#14ae5c' : value < 0 ? '#ef4444' : darkMode ? '#999' : '#4c4c4c' }
                      : {}
                  }
                >
                  {signed && value > 0 ? '+' : ''}
                  {value}
                </p>
              </div>
            ));
          })()}
        </div>

        {sorted.length > 0 && (() => {
          const lastEntry = sorted[sorted.length - 1];
          const hasWeather = lastEntry.high_temp || lastEntry.rainfall !== undefined;
          
          if (!hasWeather) return null;

          return (
            <div className={`app-shell-card p-4 sm:p-5`}>
              <div className="mb-4">
                <p className="app-section-label">Weather</p>
                <h2 className="mt-1 text-lg font-semibold">Recent weather</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'High', value: `${lastEntry.high_temp || '--'}°`, icon: <ThermometerSun color="#ff7a38" /> },
                  { label: 'Low', value: `${lastEntry.low_temp || '--'}°`, icon: <ThermometerSnowflake color="#00C0E8" /> },
                  { label: 'Rainfall', value: `${(lastEntry.rainfall || 0).toFixed(1)}mm`, icon: <Droplets color="#00C0E8" /> },
                  { label: 'Snowfall', value: `${(lastEntry.snowfall || 0).toFixed(1)}mm`, icon: <Snowflake color={darkMode ? '#cbd5e1' : '#00C0E8'} /> },
                ].map(item => (
                  <div key={item.label} className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/70'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <p className={`mt-2 text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <p className={`mt-3 text-center text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Weather data helps predict attendance</p>
            </div>
          );
        })()}

        <div className={`app-shell-card p-4 sm:p-5`}>
          <div className="mb-4">
            <p className="app-section-label">History</p>
            <h2 className="mt-1 text-lg font-semibold">Recent attendance</h2>
          </div>
          {recentEntries.map((entry, index) => {
            const trendIcon =
              index < recentEntries.length - 1 ? (
                entry.attendance > recentEntries[index + 1].attendance ? (
                  <TrendingUp className="size-3.5 text-[#14ae5c]" />
                ) : entry.attendance < recentEntries[index + 1].attendance ? (
                  <TrendingDown className="size-3.5 text-[#ef4444]" />
                ) : (
                  <Minus className="size-3.5 text-[#9ca3af]" />
                )
              ) : null;

            return (
              <div key={entry.id} className={`flex items-center rounded-2xl px-3 py-3 ${index !== recentEntries.length - 1 ? (darkMode ? 'mb-2 bg-slate-900/60' : 'mb-2 bg-slate-50/70') : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium">{format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}</p>
                  {entry.churchEvent !== 'None' && <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{entry.churchEvent}</p>}
                </div>
                {trendIcon && <span className="mr-2">{trendIcon}</span>}
                <p className="text-lg font-semibold">{entry.attendance}</p>
              </div>
            );
          })}
        </div>

        <div className={`rounded-[24px] border px-4 py-4 text-center ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white/70'}`}>
          <p className="text-lg font-semibold">CAST</p>
          <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Church Attendance Statistical Tracker</p>
          <p className={`mt-2 text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Random Forest Regression · 80 Trees · {sorted.length} training samples</p>
        </div>
      </div>
    </div>
  );
}
