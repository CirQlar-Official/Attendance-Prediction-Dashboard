import { useAttendanceData, type Group } from '../hooks/useAttendanceData';
import { useDarkMode } from '../context/DarkModeContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Sun, Moon, Network} from 'lucide-react';
import { useOutletContext } from 'react-router';
import { useState, useEffect } from 'react';
import { DataLoadingState, DataErrorState } from '../components/DataState';

export function Dashboard() {
  const { selectedGroup, isAdmin } = useOutletContext<{ selectedGroup: Group | null; isAdmin: boolean }>();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const { sorted, loading, error, getStats } = useAttendanceData(selectedGroup?.id ?? null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { darkMode, setDarkMode } = useDarkMode();
  const stats = getStats();

  const chartData = sorted.slice(isDesktop ? -30 : -10).map(entry => ({
    date: format(new Date(entry.date + 'T12:00:00'), 'MMM d'),
    attendance: entry.attendance,
  }));

  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d, yyyy');

  const metricCards = [
    { label: 'Last week', value: stats?.lastWeek ?? 0, accent: 'from-blue-500/15 to-cyan-500/10' },
    { label: 'Month avg', value: stats?.monthAvg ?? 0, accent: 'from-teal-500/15 to-emerald-500/10' },
    { label: 'YTD avg', value: stats?.ytdAvg ?? 0, accent: 'from-violet-500/15 to-fuchsia-500/10' },
  ];

  return (
    <div className="min-h-full w-full overflow-auto px-3 py-3 pb-24 text-slate-900 dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="app-shell-card-strong overflow-hidden p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{selectedGroup?.name ?? 'Attendance Group'}</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && selectedGroup?.joinCode && (
                <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-300">
                  Join code: {selectedGroup.joinCode}
                </div>
              )}
              <button onClick={() => setDarkMode(!darkMode)} className="rounded-2xl bg-slate-100 p-2.5 text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
                {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <DataLoadingState label="Loading attendance data" />
        ) : error ? (
          <DataErrorState message={error} />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 p-6 text-white shadow-[0_25px_70px_-30px_rgba(37,99,235,0.65)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-50/80">Most recent attendance</p>
                    <p className="mt-3 text-5xl font-semibold sm:text-6xl">{stats?.current ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {metricCards.map(card => (
                  <div key={card.label} className="app-shell-card rounded-[22px] border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className={`rounded-2xl bg-gradient-to-br ${card.accent} p-3`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{card.label}</p>
                      <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="app-shell-card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="app-section-label">Trend</p>
                  <h2 className="mt-1 text-lg font-semibold">Attendance trend</h2>
                </div>
                <span className="app-pill">Last {chartData.length} updates</span>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    {/* Recharts renders raw SVG and takes color values via props, not
                        classNames - it can't consume Tailwind's dark: variant, so
                        darkMode stays as JS-level logic here rather than a class. */}
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} stroke={darkMode ? '#334155' : '#cbd5e1'} />
                    <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} stroke={darkMode ? '#334155' : '#cbd5e1'} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '12px', color: darkMode ? '#f8fafc' : '#0f172a' }} />
                    <Line type="monotone" dataKey="attendance" stroke={darkMode ? '#38bdf8' : '#2563eb'} strokeWidth={3} dot={{ fill: darkMode ? '#38bdf8' : '#2563eb', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="app-shell-card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="app-section-label">Recent</p>
                  <h2 className="mt-1 text-lg font-semibold">Recent records</h2>
                </div>
                <span className="app-pill">Latest activity</span>
              </div>
              <div className="space-y-2">
                {[...sorted].reverse().slice(0, 6).map((entry, idx, arr) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-2xl px-3 py-3 ${idx !== arr.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/70' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {entry.churchEvent !== 'None' && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{entry.churchEvent}</span>}
                        {entry.isFastSunday === 1 && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300">Fast</span>}
                      </div>
                    </div>
                    <p className="text-lg font-semibold">{entry.attendance}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
