import { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { useAttendanceData, type Group } from '../hooks/useAttendanceData';
import { useDarkMode } from '../context/DarkModeContext';
import {
  CHURCH_EVENTS,
  computeLagFeatures,
  autoIsSummer,
  autoIsHoliday,
  isFastSundayDate,
  getWeekOfYear,
  type ChurchEvent,
} from '../hooks/useAttendanceData';
import { toast } from 'sonner';
import { Info, Sun, Moon, CalendarDays, CirclePlus } from 'lucide-react';

export function AddData() {
  const navigate = useNavigate();
  const { selectedGroup } = useOutletContext<{ selectedGroup: Group | null }>();
  const { sorted, addEntry } = useAttendanceData(selectedGroup?.id ?? null);
  const { darkMode, setDarkMode } = useDarkMode();

  const [date, setDate] = useState('');
  const [attendanceStr, setAttendanceStr] = useState('');
  const [churchEvent, setChurchEvent] = useState<ChurchEvent>('None');
  const [isFastSunday, setIsFastSunday] = useState<0 | 1>(0);
  const [isSummer, setIsSummer] = useState<0 | 1>(0);
  const [isHolidaySeason, setIsHolidaySeason] = useState<0 | 1>(0);

  const handleDateChange = (val: string) => {
    setDate(val);
    if (val) {
      const d = new Date(val + 'T12:00:00');
      const month = d.getMonth() + 1;
      setIsSummer(autoIsSummer(month));
      setIsHolidaySeason(autoIsHoliday(month));
      setIsFastSunday(isFastSundayDate(d));
    }
  };

  const lagPreview = useMemo(() => {
    const att = parseInt(attendanceStr);
    if (Number.isNaN(att) || att < 0) return null;
    return computeLagFeatures(sorted, att);
  }, [sorted, attendanceStr]);

  const dateInfo = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + 'T12:00:00');
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      week: getWeekOfYear(d),
    };
  }, [date]);

  const handleSave = async () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    const att = parseInt(attendanceStr);
    if (Number.isNaN(att) || att < 0) {
      toast.error('Please enter a valid attendance count');
      return;
    }

    try {
      await addEntry({
        date,
        attendance: att,
        isSummer,
        isHolidaySeason,
        churchEvent,
        isFastSunday,
      });

      toast.success('Attendance record saved!');
      navigate('/');
    } catch (error) {
      toast.error('Unable to save attendance record. Please try again.');
      console.error('Failed to save entry:', error);
    }
  };

  const handleCancel = () => navigate('/');

  const Toggle = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: 0 | 1;
    onChange: (v: 0 | 1) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(value === 1 ? 0 : 1)}
      className={`flex-1 rounded-2xl border px-3 py-3 text-center transition-all ${
        value === 1
          ? darkMode
            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
            : 'border-blue-200 bg-blue-50 text-blue-700'
          : darkMode
          ? 'border-slate-700 bg-slate-800/70 text-slate-300'
          : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs opacity-80">{value === 1 ? 'Yes' : 'No'}</p>
    </button>
  );

  return (
    <div className={`min-h-full w-full overflow-auto px-3 py-3 pb-24 sm:px-4 sm:py-4 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="app-shell-card-strong overflow-hidden p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <CirclePlus className="size-3.5" />
                Add record
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">Add attendance record</p>
                <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Lag, roll, and delta values are computed automatically from history.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-2xl p-2.5 transition ${darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>

        <div className="app-shell-card p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <CalendarDays className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="date"
                    value={date}
                    onChange={e => handleDateChange(e.target.value)}
                    className={`w-full rounded-2xl border px-10 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                  />
                </div>
                {dateInfo && (
                  <p className={`mt-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Year {dateInfo.year} · Month {dateInfo.month} · Week {dateInfo.week}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Attendance count <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={attendanceStr}
                  onChange={e => setAttendanceStr(e.target.value)}
                  placeholder="e.g. 165"
                  min="0"
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 ${darkMode ? 'border-slate-700 bg-slate-800 text-white placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'}`}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Church event</label>
                <select
                  value={churchEvent}
                  onChange={e => setChurchEvent(e.target.value as ChurchEvent)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                >
                  {CHURCH_EVENTS.map(ev => (
                    <option key={ev} value={ev}>
                      {ev}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold">Context flags</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Toggle label="Fast Sunday" value={isFastSunday} onChange={setIsFastSunday} />
                  <Toggle label="Summer" value={isSummer} onChange={setIsSummer} />
                  <Toggle label="Holiday" value={isHolidaySeason} onChange={setIsHolidaySeason} />
                </div>
              </div>

              <div className={`rounded-[24px] border p-4 ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50/80'}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Info className={`size-4 ${darkMode ? 'text-cyan-300' : 'text-blue-600'}`} />
                  <p className="text-sm font-semibold">Auto-computed model features</p>
                </div>

                {lagPreview ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Lag 1', value: lagPreview.lag1, desc: 'Last week' },
                      { label: 'Lag 4', value: lagPreview.lag4, desc: '4 weeks ago' },
                      { label: 'Roll 4', value: lagPreview.roll4, desc: '4-week avg' },
                      {
                        label: 'Delta 1',
                        value: lagPreview.delta1,
                        desc: 'lag1 − lag2',
                        signed: true,
                      },
                      {
                        label: 'Delta 4',
                        value: lagPreview.delta4,
                        desc: 'att − lag4',
                        signed: true,
                      },
                      {
                        label: 'Training rows',
                        value: sorted.length,
                        desc: 'in model',
                      },
                    ].map(({ label, value, desc, signed }) => (
                      <div key={label} className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-800 bg-slate-800/70' : 'border-slate-200 bg-white'}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                        <p
                          className={`mt-1 text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}
                          style={
                            signed
                              ? {
                                  color:
                                    value > 0 ? '#14ae5c' : value < 0 ? '#ef4444' : darkMode ? '#999' : '#4c4c4c',
                                }
                              : {}
                          }
                        >
                          {signed && value > 0 ? '+' : ''}
                          {value}
                        </p>
                        <p className={`mt-0.5 text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-[13px] italic ${darkMode ? 'text-gray-400' : 'text-[#9ca3af]'}`}>
                    Enter attendance count above to preview computed features.
                  </p>
                )}
              </div>

              {sorted.length > 0 && (
                <div className={`rounded-[24px] border p-4 ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white/70'}`}>
                  <p className={`mb-3 text-sm font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Last 4 records</p>
                  {[...sorted].reverse().slice(0, 4).map((e, idx) => (
                    <div
                      key={e.id}
                      className={`flex justify-between py-[6px] ${idx < 3 ? `border-b ${darkMode ? 'border-gray-700' : 'border-[#eceef2]'}` : ''}`}
                    >
                      <p className={`text-[12px] ${darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'}`}>
                        {e.date}
                        {e.churchEvent !== 'None' && <span className="ml-2 text-[10px] text-[#029eff]">{e.churchEvent}</span>}
                      </p>
                      <p className={`text-[12px] ${darkMode ? 'text-white' : 'text-black'}`}>{e.attendance}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSave}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-95"
                >
                  Save record
                </button>
                <button
                  onClick={handleCancel}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

