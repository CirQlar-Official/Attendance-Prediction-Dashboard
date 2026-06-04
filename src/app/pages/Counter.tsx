import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { useAttendanceData, type Group } from '../hooks/useAttendanceData';
import { useDarkMode } from '../context/DarkModeContext';
import { Plus, Minus, RotateCcw, Save, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

export function Counter() {
  const navigate = useNavigate();
  const { selectedGroup } = useOutletContext<{ selectedGroup: Group | null }>();
  const { addEntry } = useAttendanceData(selectedGroup?.id ?? null);
  const { darkMode, setDarkMode } = useDarkMode();

  const [count, setCount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Volume button handling for mobile devices
  useEffect(() => {
    const handleVolumeKeyPress = (event: KeyboardEvent) => {
      const isVolumeUp = 
        event.key === 'AudioVolumeUp' || 
        event.code === 'AudioVolumeUp' ||
        event.keyCode === 187 || // + key (not reliable for volume)
        event.key === '+';
        
      const isVolumeDown = 
        event.key === 'AudioVolumeDown' || 
        event.code === 'AudioVolumeDown' ||
        event.keyCode === 189 || // - key (not reliable for volume)
        event.key === '-';

      if (isVolumeUp) {
        event.preventDefault();
        setCount(c => c + 1);
      } else if (isVolumeDown) {
        event.preventDefault();
        setCount(c => Math.max(0, c - 1));
      }
    };

    window.addEventListener('keydown', handleVolumeKeyPress);
    return () => window.removeEventListener('keydown', handleVolumeKeyPress);
  }, []);

  const handleIncrement = () => setCount(c => c + 1);
  const handleDecrement = () => setCount(c => Math.max(0, c - 1));
  const handleReset = () => {
    if (confirm('Reset counter to 0?')) {
      setCount(0);
    }
  };

  const handleSave = async () => {
    if (count === 0) {
      toast.error('Please add some attendance first');
      return;
    }

    setIsSaving(true);
    try {
      addEntry({
        date,
        attendance: count,
        isSummer: 0,
        isHolidaySeason: 0,
        churchEvent: 'None',
        isFastSunday: 0,
      });

      toast.success(`Saved ${count} attendance record${count !== 1 ? 's' : ''}`);
      setCount(0);
      setDate(new Date().toISOString().split('T')[0]);
      
      // Navigate back to dashboard after a short delay
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      toast.error('Failed to save attendance');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`flex-1 min-h-0 w-full overflow-auto flex flex-col items-center justify-center ${
      darkMode ? 'bg-gray-900' : 'bg-white'
    }`}>
      <div className="flex flex-col gap-[16px] items-center p-[10px] w-full max-w-[500px] pb-[80px] md:pb-[20px]">
        {/* Header */}
        <div className={`w-full rounded-[15px] p-[20px] ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        }`}>
          <div className="flex items-center justify-between mb-[4px]">
            <p className={`font-['Segoe_UI'] text-[20px] font-semibold ${
              darkMode ? 'text-white' : 'text-black'
            }`}>
              Attendance Counter
            </p>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-2 rounded-lg transition ${
                darkMode ? 'bg-white text-gray-900' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {darkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
          <p className={`font-['Segoe_UI'] text-[12px] ${
            darkMode ? 'text-gray-300' : 'text-[#4c4c4c]'
          }`}>
            Tap buttons or use volume keys to count attendance
          </p>
        </div>

        {/* Date Selector */}
        <div className={`w-full rounded-[15px] p-[20px] ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        }`}>
          <label className={`font-['Segoe_UI'] text-[14px] block mb-[8px] ${
            darkMode ? 'text-white' : 'text-black'
          }`}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={`w-full rounded-[8px] px-[12px] py-[10px] font-['Segoe_UI'] text-[14px] outline-none focus:ring-2 ${
              darkMode
                ? 'bg-gray-700 text-white focus:ring-blue-500'
                : 'bg-[#d9d9d9] text-black focus:ring-[#000124]'
            }`}
          />
        </div>

        {/* Big Counter Display */}
        <div className={`w-full rounded-[15px] p-[40px] text-center ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border-2 border-[#d9d9d9]'
        }`}>
          <p className={`font-['Segoe_UI'] text-[14px] mb-[10px] ${
            darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
          }`}>
            Current Count
          </p>
          <p className={`font-['Segoe_UI'] text-[80px] font-bold mb-[10px] ${
            darkMode ? 'text-blue-400' : 'text-[#000124]'
          }`}>
            {count}
          </p>
          <p className={`font-['Segoe_UI'] text-[12px] ${
            darkMode ? 'text-gray-500' : 'text-[#9ca3af]'
          }`}>
            Attendees
          </p>
        </div>

        {/* Control Buttons */}
        <div className={`w-full rounded-[15px] p-[20px] ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        }`}>
          <div className="grid grid-cols-3 gap-[10px]">
            <button
              onClick={handleDecrement}
              disabled={count === 0}
              className={`flex flex-col items-center justify-center py-[30px] rounded-[12px] transition ${
                count === 0
                  ? darkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : darkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <Minus className="size-8 mb-[4px]" strokeWidth={2} />
              <span className="font-['Segoe_UI'] text-[12px] font-semibold">Subtract</span>
            </button>

            <button
              onClick={handleReset}
              className={`flex flex-col items-center justify-center py-[30px] rounded-[12px] transition ${
                darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
              }`}
            >
              <RotateCcw className="size-8 mb-[4px]" strokeWidth={2} />
              <span className="font-['Segoe_UI'] text-[12px] font-semibold">Reset</span>
            </button>

            <button
              onClick={handleIncrement}
              className={`flex flex-col items-center justify-center py-[30px] rounded-[12px] transition ${
                darkMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Plus className="size-8 mb-[4px]" strokeWidth={2} />
              <span className="font-['Segoe_UI'] text-[12px] font-semibold">Add</span>
            </button>
          </div>
        </div>

        {/* Quick increment buttons for large numbers */}
        <div className={`w-full rounded-[15px] p-[20px] ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        }`}>
          <p className={`font-['Segoe_UI'] text-[12px] mb-[10px] ${
            darkMode ? 'text-gray-400' : 'text-[#4c4c4c]'
          }`}>
            Quick Add
          </p>
          <div className="grid grid-cols-4 gap-[8px]">
            {[5, 10, 25, 50].map(increment => (
              <button
                key={increment}
                onClick={() => setCount(c => c + increment)}
                className={`py-[12px] rounded-[8px] font-semibold transition ${
                  darkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-[#000124] hover:bg-[#000814] text-white'
                }`}
              >
                <span className="font-['Segoe_UI'] text-[14px]">+{increment}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className={`w-full rounded-[15px] p-[20px] ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        }`}>
          <button
            onClick={handleSave}
            disabled={isSaving || count === 0}
            className={`w-full h-[50px] rounded-[8px] flex items-center justify-center font-semibold transition ${
              isSaving || count === 0
                ? darkMode
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : darkMode
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-[#000124] hover:bg-[#000814] text-white'
            }`}
          >
            <Save className="size-5 mr-[8px]" strokeWidth={2} />
            <span className="font-['Segoe_UI'] text-[16px]">
              {isSaving ? 'Saving...' : 'Save Record'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
