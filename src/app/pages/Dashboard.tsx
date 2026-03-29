import { useAttendanceData } from '../hooks/useAttendanceData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

export function Dashboard() {
  const { sorted, getStats } = useAttendanceData();
  const stats = getStats();

  const chartData = sorted.slice(-10).map(entry => ({
    date: format(new Date(entry.date + 'T12:00:00'), 'MMM d'),
    attendance: entry.attendance,
  }));

  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d, yyyy');

  return (
    <div className="flex-1 min-h-0 w-full overflow-auto">
      <div className="flex flex-col gap-[20px] items-start p-[10px] w-full">
        {/* Header */}
        <div className="flex flex-col items-center justify-center pt-[50px] w-full text-center">
          <p className="font-['Segoe_UI'] font-semibold text-[24px] text-black">
            Avon 2nd Ward
          </p>
          <p className="font-['Segoe_UI'] text-[16px] text-[#4c4c4c]">
            {formattedDate}
          </p>
        </div>

        {/* Current Attendance */}
        <div className="bg-[#000124] h-[150px] w-full rounded-[15px] p-[30px] flex flex-col items-center justify-between text-center text-white">
          <p className="font-['Segoe_UI'] font-semibold text-[20px]">
            Most Recent Attendance
          </p>
          <p className="font-['Segoe_UI'] font-light text-[48px]">
            {stats?.current ?? 0}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-[10px] w-full">
          <div className="rounded-[15px] border-2 border-[#eceef2] p-[15px] flex flex-col items-start justify-between h-[110px]">
            <p className="font-['Segoe_UI'] text-[12px] text-[#4c4c4c]">
              Last Week
            </p>
            <p className="font-['Segoe_UI'] text-[22px] text-black">
              {stats?.lastWeek ?? 0}
            </p>
          </div>

          <div className="rounded-[15px] border-2 border-[#eceef2] p-[15px] flex flex-col items-start justify-between h-[110px]">
            <p className="font-['Segoe_UI'] text-[12px] text-[#4c4c4c]">
              Month Avg
            </p>
            <p className="font-['Segoe_UI'] text-[22px] text-black">
              {stats?.monthAvg ?? 0}
            </p>
          </div>

          <div className="rounded-[15px] border-2 border-[#eceef2] p-[15px] flex flex-col items-start justify-between h-[110px]">
            <p className="font-['Segoe_UI'] text-[12px] text-[#4c4c4c]">
              YTD Avg
            </p>
            <p className="font-['Segoe_UI'] text-[22px] text-black">
              {stats?.ytdAvg ?? 0}
            </p>
          </div>
        </div>

        {/* Graph */}
        <div className="h-[300px] w-full rounded-[15px] border-2 border-[#eceef2] p-[20px]">
          <p className="font-['Segoe_UI'] text-[16px] text-black mb-[15px]">
            Attendance Trend (Last 10 Sundays)
          </p>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#4c4c4c' }}
                stroke="#eceef2"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#4c4c4c' }}
                stroke="#eceef2"
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #eceef2',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="attendance"
                stroke="#000124"
                strokeWidth={2}
                dot={{ fill: '#000124', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent records */}
        <div className="w-full rounded-[15px] border-2 border-[#eceef2] p-[20px]">
          <p className="font-['Segoe_UI'] text-[16px] text-black mb-[10px]">
            Recent Records
          </p>
          {[...sorted].reverse().slice(0, 6).map((entry, idx, arr) => (
            <div
              key={entry.id}
              className={`h-[50px] w-full flex items-center px-[10px] ${
                idx !== arr.length - 1 ? 'border-b border-[#eceef2]' : ''
              }`}
            >
              <p className="flex-1 font-['Segoe_UI'] text-[14px] text-black">
                {format(new Date(entry.date + 'T12:00:00'), 'MMM d, yyyy')}
              </p>
              {entry.churchEvent !== 'None' && (
                <span className="text-[11px] bg-[#eceef2] text-[#4c4c4c] rounded px-2 py-0.5 mr-2">
                  {entry.churchEvent}
                </span>
              )}
              {entry.isFastSunday === 1 && (
                <span className="text-[11px] bg-[#000124] text-white rounded px-2 py-0.5 mr-2">
                  Fast
                </span>
              )}
              <p className="font-['Segoe_UI'] text-[16px] text-black">
                {entry.attendance}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
