import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAttendanceData } from '../hooks/useAttendanceData';
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
import { Info, Sun, Moon } from 'lucide-react';

export function AddData() {
  const navigate = useNavigate();
  const { sorted, addEntry } = useAttendanceData();
  const { darkMode, setDarkMode } = useDarkMode();

  // ── User inputs ─────────────────────────────────────────────────────────────
  const [date, setDate] = useState('');
  const [attendanceStr, setAttendanceStr] = useState('');
  const [churchEvent, setChurchEvent] = useState<ChurchEvent>('None');

  // Auto-suggested but overridable
  const [isFastSunday, setIsFastSunday] = useState<0 | 1>(0);
  const [isSummer, setIsSummer] = useState<0 | 1>(0);
  const [isHolidaySeason, setIsHolidaySeason] = useState<0 | 1>(0);

  // Auto-update toggles when date changes
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

  // ── Auto-computed lag features preview ─────────────────────────────────────
  const lagPreview = useMemo(() => {
    const att = parseInt(attendanceStr);
    if (isNaN(att) || att < 0) return null;
    return computeLagFeatures(sorted, att);
  }, [sorted, attendanceStr]);

  // Derived date info
  const dateInfo = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + 'T12:00:00');
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      week: getWeekOfYear(d),
    };
  }, [date]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    const att = parseInt(attendanceStr);
    if (isNaN(att) || att < 0) {
      toast.error('Please enter a valid attendance count');
      return;
    }

    addEntry({
      date,
      attendance: att,
      isSummer,
      isHolidaySeason,
      churchEvent,
      isFastSunday,
    });

    toast.success('Attendance record saved!');
    navigate('/');
  };

  const handleCancel = () => navigate('/');

  // ── UI helpers ───────────────────────────────────────────────────────────────
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
      className={`flex-1 rounded-[8px] py-[10px] text-center transition-colors ${
        value === 1
          ? darkMode ? 'bg-blue-600 text-white' : 'bg-[#000124] text-white'
          : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-[#d9d9d9] text-black'
      }`}
    >
      <p className="font-['Segoe_UI'] text-[13px]">{label}</p>
      <p className="font-['Segoe_UI'] text-[11px] mt-0.5 opacity-70">
        {value === 1 ? 'Yes' : 'No'}
      </p>
    </button>
  );

  return (
    <div className={`flex-1 min-h-0 w-full overflow-auto ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="flex flex-col gap-[16px] items-start p-[10px] w-full pb-[80px]">
        <div className={`w-full rounded-[15px] p-[20px] ${
          darkMode
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white'
        }`}>
          <div className="flex items-center justify-between mb-[4px]">
            <p className={`font-['Segoe_UI'] text-[20px] ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Add Attendance Record
            </p>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-2 rounded-lg transition ${
                darkMode
                  ? 'bg-yellow-500 text-gray-900'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
          <p className={`font-['Segoe_UI'] text-[12px] mb-[20px] ${
            darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
          }`}>
            Lag, Roll & Delta values are computed automatically from history.
          </p>

          {/* ── Date ── */}
          <div className="mb-[14px]">
            <label className={`font-['Segoe_UI'] text-[14px] block mb-[6px] ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Date <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => handleDateChange(e.target.value)}
              className={`w-full rounded-[8px] px-[12px] py-[10px] font-['Segoe_UI'] text-[14px] outline-none focus:ring-2 ${
                darkMode
                  ? 'bg-gray-700 text-white focus:ring-blue-500'
                  : 'bg-[#d9d9d9] text-black focus:ring-[#000124]'
              }`}
            />
            {dateInfo && (
              <p className={`font-['Segoe_UI'] text-[11px] mt-1 ${
                darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
              }`}>
                Year {dateInfo.year} · Month {dateInfo.month} · Week {dateInfo.week}
              </p>
            )}
          </div>

          {/* ── Attendance ── */}
          <div className="mb-[14px]">
            <label className={`font-['Segoe_UI'] text-[14px] block mb-[6px] ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Attendance Count <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="number"
              value={attendanceStr}
              onChange={e => setAttendanceStr(e.target.value)}
              placeholder="e.g. 165"
              min="0"
              className={`w-full rounded-[8px] px-[12px] py-[10px] font-['Segoe_UI'] text-[14px] outline-none focus:ring-2 ${
                darkMode
                  ? 'bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
                  : 'bg-[#d9d9d9] text-black focus:ring-[#000124]'
              }`}
            />
          </div>

          {/* ── Church Event ── */}
          <div className="mb-[14px]">
            <label className={`font-['Segoe_UI'] text-[14px] block mb-[6px] ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Church Event
            </label>
            <select
              value={churchEvent}
              onChange={e => setChurchEvent(e.target.value as ChurchEvent)}
              className={`w-full rounded-[8px] px-[12px] py-[10px] font-['Segoe_UI'] text-[14px] outline-none focus:ring-2 ${
                darkMode
                  ? 'bg-gray-700 text-white focus:ring-blue-500'
                  : 'bg-[#d9d9d9] text-black focus:ring-[#000124]'
              }`}
            >
              {CHURCH_EVENTS.map(ev => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>

          {/* ── Boolean Flags ── */}
          <div className="mb-[20px]">
            <label className={`font-['Segoe_UI'] text-[14px] block mb-[6px] ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Context Flags
              <span className={`font-['Segoe_UI'] text-[11px] ml-2 ${
                darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
              }`}>
                (auto-suggested from date)
              </span>
            </label>
            <div className="flex gap-[8px]">
              <Toggle
                label="Fast Sunday"
                value={isFastSunday}
                onChange={setIsFastSunday}
              />
              <Toggle
                label="Summer"
                value={isSummer}
                onChange={setIsSummer}
              />
              <Toggle
                label="Holiday Season"
                value={isHolidaySeason}
                onChange={setIsHolidaySeason}
              />
            </div>
          </div>

          {/* ── Auto-computed Features Preview ── */}
          <div className={`rounded-[12px] border p-[16px] mb-[20px] ${
            darkMode
              ? 'border-gray-700 bg-gray-800'
              : 'border-[#eceef2] bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-[10px]">
              <Info className={`size-4 ${darkMode ? 'text-blue-400' : 'text-[#029eff]'}`} />
              <p className={`font-['Segoe_UI'] text-[13px] ${
                darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
              }`}>
                Auto-computed model features
              </p>
            </div>

            {lagPreview ? (
              <div className="grid grid-cols-3 gap-[8px]">
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
                  <div
                    key={label}
                    className={`rounded-[8px] p-[10px] flex flex-col ${
                      darkMode ? 'bg-gray-700' : 'bg-[#f7f8fa]'
                    }`}
                  >
                    <p className={`font-['Segoe_UI'] text-[10px] uppercase tracking-wide ${
                      darkMode ? 'text-gray-400' : 'text-[#9ca3af]'
                    }`}>
                      {label}
                    </p>
                    <p
                      className={`font-['Segoe_UI'] text-[18px] mt-1 ${
                        darkMode ? 'text-white' : 'text-black'
                      }`}
                      style={
                        signed
                          ? {
                              color:
                                value > 0
                                  ? '#14ae5c'
                                  : value < 0
                                  ? '#ef4444'
                                  : darkMode ? '#999' : '#4c4c4c',
                            }
                          : {}
                      }
                    >
                      {signed && value > 0 ? '+' : ''}
                      {value}
                    </p>
                    <p className={`font-['Segoe_UI'] text-[10px] mt-0.5 ${
                      darkMode ? 'text-gray-400' : 'text-[#9ca3af]'
                    }`}>
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`font-['Segoe_UI'] text-[13px] italic ${
                darkMode ? 'text-gray-400' : 'text-[#9ca3af]'
              }`}>
                Enter attendance count above to preview computed features.
              </p>
            )}
          </div>

          {/* ── Recent history for reference ── */}
          {sorted.length > 0 && (
            <div className={`rounded-[12px] border p-[14px] mb-[20px] ${
              darkMode
                ? 'border-gray-700 bg-gray-800'
                : 'border-[#eceef2] bg-white'
            }`}>
              <p className={`font-['Segoe_UI'] text-[12px] mb-[8px] ${
                darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
              }`}>
                Last 4 records (for reference)
              </p>
              {[...sorted].reverse().slice(0, 4).map((e, idx) => (
                <div
                  key={e.id}
                  className={`flex justify-between py-[6px] ${
                    idx < 3 ? `border-b ${darkMode ? 'border-gray-700' : 'border-[#eceef2]'}` : ''
                  }`}
                >
                  <p className={`font-['Segoe_UI'] text-[12px] ${
                    darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
                  }`}>
                    {e.date}
                    {e.churchEvent !== 'None' && (
                      <span className="ml-2 text-[10px] text-[#029eff]">
                        {e.churchEvent}
                      </span>
                    )}
                  </p>
                  <p className={`font-['Segoe_UI'] text-[12px] ${
                    darkMode ? 'text-white' : 'text-black'
                  }`}>
                    {e.attendance}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Buttons ── */}
          <div className="w-full flex gap-[10px]">
            <button
              onClick={handleSave}
              className={`flex-1 h-[44px] rounded-[8px] flex items-center justify-center font-semibold text-white ${
                darkMode
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-[#000124] hover:bg-[#000814]'
              }`}
            >
              <span className="font-['Segoe_UI'] text-[15px] text-white">
                Save Record
              </span>
            </button>
            <button
              onClick={handleCancel}
              className={`flex-1 h-[44px] rounded-[8px] border flex items-center justify-center ${
                darkMode
                  ? 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                  : 'border-[#d9d9d9] bg-white hover:bg-[#f7f8fa]'
              }`}
            >
              <span className={`font-['Segoe_UI'] text-[15px] ${
                darkMode ? 'text-gray-300' : 'text-black'
              }`}>
                Cancel
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
