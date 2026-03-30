import { Link, useLocation } from 'react-router';
import { Home, Plus, TrendingUp } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

interface BottomNavProps {
  isAdmin: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const location = useLocation();
  const { darkMode } = useDarkMode();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`fixed bottom-0 left-0 right-0 h-[60px] z-50 ${
      darkMode
        ? 'bg-gray-800 border-t-2 border-gray-700'
        : 'bg-white border-t-2 border-[#eceef2]'
    }`}>
      <div className="flex items-center justify-between px-[50px] py-[5px] h-full">
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center gap-1 px-[5px] py-[4px] rounded-[5px] h-full ${
            isActive('/') 
              ? darkMode ? 'bg-gray-700' : 'bg-[#e9ebef]'
              : ''
          }`}
        >
          <Home className={`size-5 ${isActive('/') 
            ? darkMode ? 'text-blue-400' : 'text-black'
            : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
          }`} strokeWidth={1.6} />
          <span className={`text-[14px] font-['Segoe_UI'] ${
            isActive('/') 
              ? darkMode ? 'text-blue-400' : 'text-black'
              : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
          }`}>
            Dashboard
          </span>
        </Link>

        {isAdmin && (
          <Link 
            to="/add-data" 
            className={`flex flex-col items-center justify-center gap-[5px] px-[5px] py-[4px] rounded-[5px] h-full ${
              isActive('/add-data')
                ? darkMode ? 'bg-gray-700' : 'bg-[#e9ebef]'
                : ''
            }`}
          >
            <Plus className={`size-5 ${isActive('/add-data')
              ? darkMode ? 'text-blue-400' : 'text-black'
              : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
            }`} strokeWidth={1.5} />
            <span className={`text-[14px] font-['Segoe_UI'] ${
              isActive('/add-data')
                ? darkMode ? 'text-blue-400' : 'text-black'
                : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
            }`}>
              Add Data
            </span>
          </Link>
        )}

        <Link 
          to="/forecast" 
          className={`flex flex-col items-center justify-between px-[5px] py-[3px] rounded-[5px] h-full ${
            isActive('/forecast')
              ? darkMode ? 'bg-gray-700' : 'bg-[#e9ebef]'
              : ''
          }`}
        >
          <TrendingUp className={`size-5 ${isActive('/forecast')
            ? darkMode ? 'text-blue-400' : 'text-black'
            : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
          }`} strokeWidth={1.24} />
          <span className={`text-[14px] font-['Segoe_UI'] ${
            isActive('/forecast')
              ? darkMode ? 'text-blue-400' : 'text-black'
              : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
            }`}>
            Forecast
          </span>
        </Link>
      </div>
    </div>
  );
}