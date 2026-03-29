import { Link, useLocation } from 'react-router';
import { Home, Plus, TrendingUp } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="bg-white h-[60px] shrink-0 w-full border-t-2 border-[#eceef2]">
      <div className="flex items-center justify-between px-[50px] py-[5px] h-full">
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center gap-1 px-[5px] py-[4px] rounded-[5px] h-full ${
            isActive('/') ? 'bg-[#e9ebef]' : ''
          }`}
        >
          <Home className={`size-5 ${isActive('/') ? 'text-black' : 'text-[#9f9f9f]'}`} strokeWidth={1.6} />
          <span className={`text-[14px] font-['Segoe_UI'] ${
            isActive('/') ? 'text-black' : 'text-[#9f9f9f]'
          }`}>
            Dashboard
          </span>
        </Link>

        <Link 
          to="/add-data" 
          className={`flex flex-col items-center justify-center gap-[5px] px-[5px] py-[4px] rounded-[5px] h-full ${
            isActive('/add-data') ? 'bg-[#e9ebef]' : ''
          }`}
        >
          <Plus className={`size-5 ${isActive('/add-data') ? 'text-black' : 'text-[#9f9f9f]'}`} strokeWidth={1.5} />
          <span className={`text-[14px] font-['Segoe_UI'] ${
            isActive('/add-data') ? 'text-black' : 'text-[#9f9f9f]'
          }`}>
            Add Data
          </span>
        </Link>

        <Link 
          to="/forecast" 
          className={`flex flex-col items-center justify-between px-[5px] py-[3px] rounded-[5px] h-full ${
            isActive('/forecast') ? 'bg-[#e9ebef]' : ''
          }`}
        >
          <TrendingUp className={`size-5 ${isActive('/forecast') ? 'text-black' : 'text-[#9f9f9f]'}`} strokeWidth={1.24} />
          <span className={`text-[14px] font-['Segoe_UI'] ${
            isActive('/forecast') ? 'text-black' : 'text-[#9f9f9f]'
          }`}>
            Forecast
          </span>
        </Link>
      </div>
    </div>
  );
}
