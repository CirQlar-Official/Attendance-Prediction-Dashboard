
import { useState, useMemo } from 'react';
import { useAttendanceData } from '../hooks/useAttendanceData';
import { useDarkMode } from '../context/DarkModeContext';
import {
  CHURCH_EVENTS,
  autoIsSummer,
  autoIsHoliday,
  isFastSundayDate,
  getWeekOfYear,
  type ChurchEvent,
} from '../hooks/useAttendanceData';
import { format, addDays, nextSunday as getNextSunday } from 'date-fns';
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
  const { sorted, predictNextAttendance } = useAttendanceData();
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
    <div className={`flex-1 min-h-0 w-full overflow-auto ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="flex flex-col gap-[20px] items-start p-[10px] w-full pb-[80px]">
        {/* Header with Dark Mode Toggle */}
        <div className="flex flex-col items-center justify-center pt-[50px] w-full text-center gap-4">
          <div className="flex items-center justify-between w-full px-4">
            <div className="w-8" /> {/* spacer */}
            <div>
              <p className={`font-['Segoe_UI'] font-semibold text-[24px] ${darkMode ? 'text-white' : 'text-black'}`}>
                Attendance Forecast
              </p>
              <p className={`font-['Segoe_UI'] text-[14px] ${darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'}`}>
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
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
          
          <p className="font-['Segoe_UI'] text-[12px] text-[#029eff] mt-1">
            Predicting: {format(nextSunday, 'MMMM d, yyyy')}
          </p>
        </div>

        {/* Prediction Card */}
        <div
          className="w-full rounded-[15px] p-[30px] flex flex-col items-center justify-between border-2 border-[#029eff] gap-4"
          style={{
            background: darkMode
              ? 'linear-gradient(135deg, rgba(20,30,60,0.95) 0%, rgba(10,40,80,0.95) 100%)'
              : 'linear-gradient(135deg, rgba(0,1,36,0.92) 0%, rgba(0,60,120,0.88) 100%)',
          }}
        >
          <p className="font-['Segoe_UI'] font-semibold text-[18px] text-white">
            RF Model Prediction
          </p>

          <p className="font-['Segoe_UI'] font-light text-[60px] text-white leading-none">
            {prediction}
          </p>

          <p className="font-['Segoe_UI'] text-[13px] text-[#aac4ff]">
            ± {std} range across {result.treePredictions.length} trees
          </p>

          <div className="w-full flex items-center justify-between">
            <p
              className="font-['Segoe_UI'] font-semibold text-[14px]"
              style={{ color: confidenceColor }}
            >
              {confidenceLabel}
            </p>
            <div className="flex items-center gap-1">
              {diff > 0 ? (
                <ChevronUp className="size-4 text-[#14ae5c]" />
              ) : diff < 0 ? (
                <ChevronDown className="size-4 text-[#ff4f4f]" />
              ) : (
                <Minus className="size-4 text-white" />
              )}
              <p
                className="font-['Segoe_UI'] text-[14px]"
                style={{
                  color: diff > 0 ? '#14ae5c' : diff < 0 ? '#ff4f4f' : 'white',
                }}
              >
                {diff > 0 ? '+' : ''}
                {diff} ({pctChange}%) vs last week
              </p>
            </div>
          </div>
        </div>

        {/* Context Controls */}
        <div className={`w-full rounded-[15px] border-2 p-[20px] ${
          darkMode 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-[#eceef2] bg-white'
        }`}>
          <p className={`font-['Segoe_UI'] text-[16px] mb-[15px] ${
            darkMode ? 'text-white' : 'text-black'
          }`}>
            Adjust Next-Week Context
          </p>

          {/* Church Event */}
          <div className="mb-[12px]">
            <label className={`font-['Segoe_UI'] text-[13px] block mb-[6px] ${
              darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
            }`}>
              Church Event
            </label>
            <select
              value={churchEvent}
              onChange={e => setChurchEvent(e.target.value as ChurchEvent)}
              className={`w-full rounded-[8px] px-[10px] py-[8px] font-['Segoe_UI'] text-[14px] outline-none focus:ring-2 focus:ring-[#029eff] ${
                darkMode
                  ? 'bg-gray-700 text-white'
                  : 'bg-[#eceef2] text-black'
              }`}
            >
              {CHURCH_EVENTS.map(ev => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle flags */}
          <div className="grid grid-cols-3 gap-[8px]">
            {[
              {
                label: 'Fast Sunday',
                value: isFastSunday,
                set: setIsFastSunday,
              },
              {
                label: 'Summer',
                value: isSummer,
                set: setIsSummer,
              },
              {
                label: 'Holiday Season',
                value: isHolidaySeason,
                set: setIsHolidaySeason,
              },
            ].map(({ label, value, set }) => (
              <button
                key={label}
                onClick={() => set(value === 1 ? 0 : 1)}
                className={`rounded-[8px] py-[10px] px-[6px] text-center transition-colors flex flex-col items-center justify-center ${
                  value === 1
                    ? 'bg-[#029eff] text-white'
                    : darkMode
                    ? 'bg-gray-700 text-gray-300'
                    : 'bg-[#eceef2] text-[#4c4c4c]'
                }`}
              >
                <p className="font-['Segoe_UI'] text-[12px]">{label}</p>
                {value === 1 ? (
                  <Check className="size-4 mt-1" />
                ) : (
                  <X className="size-4 mt-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Importances */}
        {topImps.length > 0 && (
          <div className={`w-full rounded-[15px] border-2 p-[20px] ${
            darkMode 
              ? 'border-gray-700 bg-gray-800' 
              : 'border-[#eceef2] bg-white'
          }`}>
            <div className="flex items-center gap-2 mb-[15px]">
              <BarChart2 className={`size-4 ${darkMode ? 'text-[#029eff]' : 'text-[#000124]'}`} />
              <p className={`font-['Segoe_UI'] text-[16px] ${
                darkMode ? 'text-white' : 'text-black'
              }`}>
                Feature Importances
              </p>
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
            <p className={`font-['Segoe_UI'] text-[10px] mt-2 text-center ${
              darkMode ? 'text-gray-400' : 'text-[#9ca3af]'
            }`}>
              Weighted split-frequency across {result.treePredictions.length} RF trees
            </p>
          </div>
        )}

        {/* Model Inputs Used */}
        <div className={`w-full rounded-[15px] border-2 p-[20px] ${
          darkMode 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-[#eceef2] bg-white'
        }`}>
          <p className={`font-['Segoe_UI'] text-[16px] mb-[12px] ${
            darkMode ? 'text-white' : 'text-black'
          }`}>
            Model Inputs (Next Week)
          </p>
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
              <div
                key={label}
                className={`flex items-center justify-between py-[8px] border-b last:border-b-0 ${
                  darkMode ? 'border-gray-700' : 'border-[#eceef2]'
                }`}
              >
                <p className={`font-['Segoe_UI'] text-[13px] ${
                  darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
                }`}>
                  {label}
                </p>
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

        {/* Weather Conditions */}
        {sorted.length > 0 && (() => {
          const lastEntry = sorted[sorted.length - 1];
          const hasWeather = lastEntry.temperatureHigh || lastEntry.precipitation !== undefined;
          
          if (!hasWeather) return null;

          return (
            <div className={`w-full rounded-[15px] border-2 p-[20px] ${
              darkMode
                ? 'border-gray-700 bg-gray-800'
                : 'border-[#eceef2] bg-white'
            }`}>
              <p className={`font-['Segoe_UI'] text-[16px] mb-[12px] ${
                darkMode ? 'text-white' : 'text-black'
              }`}>
                Recent Weather
              </p>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <p className={`font-['Segoe_UI'] text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'}`}>
                    🌡️ High
                  </p>
                  <p className={`font-['Segoe_UI'] text-[18px] ${darkMode ? 'text-white' : 'text-black'}`}>
                    {lastEntry.temperatureHigh || '--'}°
                  </p>
                </div>
                <div>
                  <p className={`font-['Segoe_UI'] text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'}`}>
                    ❄️ Low
                  </p>
                  <p className={`font-['Segoe_UI'] text-[18px] ${darkMode ? 'text-white' : 'text-black'}`}>
                    {lastEntry.temperatureLow || '--'}°
                  </p>
                </div>
                <div>
                  <p className={`font-['Segoe_UI'] text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'}`}>
                    🌧️ Rain
                  </p>
                  <p className={`font-['Segoe_UI'] text-[18px] ${darkMode ? 'text-white' : 'text-black'}`}>
                    {(lastEntry.precipitation || 0).toFixed(1)}mm
                  </p>
                </div>
                <div>
                  <p className={`font-['Segoe_UI'] text-[12px] ${darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'}`}>
                    ❄ Snow
                  </p>
                  <p className={`font-['Segoe_UI'] text-[18px] ${darkMode ? 'text-white' : 'text-black'}`}>
                    {(lastEntry.snow || 0).toFixed(1)}mm
                  </p>
                </div>
              </div>
              <p className={`font-['Segoe_UI'] text-[10px] mt-[10px] text-center ${
                darkMode ? 'text-gray-500' : 'text-[#9ca3af]'
              }`}>
                Weather data helps predict attendance
              </p>
            </div>
          );
        })()}

        {/* Recent Attendance */}
        <div className={`w-full rounded-[15px] border-2 p-[20px] mb-[80px] ${
          darkMode 
            ? 'border-gray-700 bg-gray-800' 
            : 'border-[#eceef2] bg-white'
        }`}>
          <p className={`font-['Segoe_UI'] text-[16px] mb-[10px] ${
            darkMode ? 'text-white' : 'text-black'
          }`}>
            Recent Attendance
          </p>
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
              <div
                key={entry.id}
                className={`flex items-center py-[10px] ${
                  index !== recentEntries.length - 1
                    ? darkMode ? 'border-b border-gray-700' : 'border-b border-[#eceef2]'
                    : ''
                }`}
              >
                <div className="flex-1">
                  <p className={`font-['Segoe_UI'] text-[14px] ${
                    darkMode ? 'text-white' : 'text-black'
                  }`}>
                    {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}
                  </p>
                  {entry.churchEvent !== 'None' && (
                    <p className={`font-['Segoe_UI'] text-[11px] ${
                      darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
                    }`}>
                      {entry.churchEvent}
                    </p>
                  )}
                </div>
                {trendIcon && <span className="mr-2">{trendIcon}</span>}
                <p className={`font-['Segoe_UI'] text-[16px] ${
                  darkMode ? 'text-white' : 'text-black'
                }`}>
                  {entry.attendance}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`w-full rounded-[15px] border-2 p-[10px] flex flex-col items-center gap-[6px] ${
          darkMode
            ? 'border-gray-700 bg-gray-800'
            : 'border-[#eceef2] bg-white'
        }`}>
          <p className={`font-['Segoe_UI'] text-[18px] ${darkMode ? 'text-white' : 'text-black'}`}>CAST</p>
          <p className={`font-['Segoe_UI'] text-[12px] ${darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'}`}>
            Church Attendance Statistical Tracker & Analyzer
          </p>
          <p className={`font-['Segoe_UI'] text-[10px] ${darkMode ? 'text-gray-400' : 'text-[#9ca3af]'}`}>
            Random Forest Regression · 80 Trees · 76 Training Samples
          </p>
        </div>
      </div>
    </div>
  );
}
