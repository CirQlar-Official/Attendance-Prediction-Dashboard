import { Link, useLocation } from 'react-router';

import { Home, Plus, TrendingUp, Menu, X, Clock, Users, LogOut } from 'lucide-react';

import { useDarkMode } from '../context/DarkModeContext';

import { useRef, useEffect, useState } from 'react';

import { leaveGroup } from '../../lib/supabase';

import { toast } from 'sonner';

import type { Group } from '../hooks/useAttendanceData';

interface BottomNavProps {
  isAdmin: boolean;
  onLeaveGroup: () => void;
  selectedGroup: Group | null;
}


export function BottomNav({ isAdmin, onLeaveGroup, selectedGroup }: BottomNavProps) {
  const location = useLocation();
  const { darkMode } = useDarkMode();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState({ offset: 0, size: 0 });
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [leavingGroup, setLeavingGroup] = useState(false);

  const isActive = (path: string) => location.pathname === path;

const tabs = [
  { path: '/', icon: Home, label: 'Dashboard', strokeWidth: 1.6 },
  { path: '/add-data', icon: Plus, label: 'Add Data', strokeWidth: 1.5 },
  { path: '/forecast', icon: TrendingUp, label: 'Forecast', strokeWidth: 1.24 },
  { path: '/history', icon: Clock, label: 'History', strokeWidth: 1.5 },
  ...(isAdmin ? [{ path: '/members', icon: Users, label: 'Members', strokeWidth: 1.5 }] : []),
];

  const activeIndex = tabs.findIndex(t => t.path === location.pathname);

  // Track desktop vs mobile
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Measure active tab for pill
  useEffect(() => {
    const activeEl = tabRefs.current[activeIndex];
    if (!activeEl) return;
    const parent = activeEl.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    if (isDesktop) {
      setPillStyle({
        offset: elRect.top - parentRect.top,
        size: elRect.height,
      });
    } else {
      setPillStyle({
        offset: elRect.left - parentRect.left,
        size: elRect.width,
      });
    }
  }, [activeIndex, location.pathname, isDesktop, sidebarOpen]);

  const pillTransitionStyle = isDesktop
    ? {
        top: pillStyle.offset,
        height: pillStyle.size,
        width: '100%',
        transition: 'top 300ms ease-out, height 300ms ease-out',
      }
    : {
        left: pillStyle.offset,
        width: pillStyle.size,
        transition: 'left 300ms ease-out, width 300ms ease-out',
      };


  useEffect(() => {
    if (!isDesktop) {
      document.documentElement.style.removeProperty('--sidebar-width');
    }
  }, [isDesktop]);

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group? You\'ll need to rejoin with a code to access it again.')) {
      return;
    }

    setLeavingGroup(true);
    try {
      const user = await (await import('../../lib/supabase')).getCurrentUser();
      if (user) {
        await leaveGroup(user.id);
        onLeaveGroup();
        toast.success('You have left the group.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to leave group.');
    } finally {
      setLeavingGroup(false);
    }
  };

  if (isDesktop) {
    return (
      <>
        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full z-50 flex flex-col py-[30px] px-[12px] gap-[6px] overflow-hidden
            ${darkMode ? 'bg-gray-800 border-r-2 border-gray-700' : 'bg-white border-r-2 border-[#eceef2]'}
          `}
          style={{
            width: sidebarOpen ? '200px' : '65px',
            transition: 'width 300ms ease-out',
          }}
        >
          <div
            className="flex items-center mb-[20px] px-[10px] min-w-0"
            style={{ justifyContent: sidebarOpen ? 'space-between' : 'center' }}
          >
            {sidebarOpen && (
              <p
                className={`font-['Segoe_UI'] font-semibold text-[16px] whitespace-nowrap
                  ${darkMode ? 'text-white' : 'text-black'}
                `}
              >
                CAST
              </p>
            )}

            <button
              onClick={() => setSidebarOpen(prev => !prev)}
              className={`shrink-0 p-[4px] rounded-[6px] transition-colors
                ${darkMode
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-[#9f9f9f] hover:text-black hover:bg-[#e9ebef]'}
              `}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
            </button>

          </div>

          <div className="relative flex flex-col gap-[4px] flex-1">
            {/* Sliding pill */}
            {activeIndex >= 0 && pillStyle.size > 0 && (
              <div
                className={`absolute left-0 right-0 rounded-[8px] ${
                  darkMode ? 'bg-gray-700' : 'bg-[#e9ebef]'
                }`}
                style={pillTransitionStyle}
              />
            )}

            {tabs.map(({ path, icon: Icon, label, strokeWidth }, i) => (
              <Link
                key={path}
                to={path}
                ref={el => { tabRefs.current[i] = el; }}
                className="relative flex flex-row items-center gap-[10px] px-[10px] py-[10px] z-10 rounded-[8px]"
                style={{ minWidth: 0 }}
              >
                <Icon
                  className={`size-5 shrink-0 ${
                    isActive(path)
                      ? darkMode ? 'text-blue-400' : 'text-black'
                      : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
                  }`}
                  strokeWidth={strokeWidth}
                />
                {/* Label fades out when collapsed */}
                <span
                  className={`text-[14px] font-['Segoe_UI'] whitespace-nowrap overflow-hidden
                    ${isActive(path)
                      ? darkMode ? 'text-blue-400' : 'text-black'
                      : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'}
                  `}
                  style={{
                    opacity: sidebarOpen ? 1 : 0,
                    maxWidth: sidebarOpen ? '200px' : '0px',
                    transition: 'opacity 200ms ease-out, max-width 300ms ease-out',
                  }}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>

          <button
            onClick={handleLeaveGroup}
            disabled={leavingGroup}
            className={`flex flex-row items-center gap-[10px] px-[10px] py-[10px] rounded-[8px] transition-colors ${
              darkMode
                ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700'
                : 'text-[#9f9f9f] hover:text-red-600 hover:bg-[#e9ebef]'
            } ${leavingGroup ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Leave group"
          >
            <LogOut size={18} strokeWidth={1.8} />
            {sidebarOpen && (
              <span className="text-[14px] font-['Segoe_UI'] whitespace-nowrap">
                {leavingGroup ? 'Leaving...' : 'Leave Group'}
              </span>
            )}
          </button>

        </div>

        <div
          style={{
            width: sidebarOpen ? '200px' : '65px',
            flexShrink: 0,
            transition: 'width 300ms ease-out',
          }}
        />

      </>
    );
  }

  // ── Mobile bottom nav ────────────────────────────────────────────────────────
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${
      darkMode ? 'bg-gray-800 border-t-2 border-gray-700' : 'bg-white border-t-2 border-[#eceef2]'
    }`}>
      <div className="relative flex items-center justify-around max-w-[500px] mx-auto px-4 py-[8px] h-[70px]">
        {/* Sliding pill */}
        {activeIndex >= 0 && pillStyle.size > 0 && (
          <div
            className={`absolute top-[8px] bottom-[8px] rounded-[8px] ${
              darkMode ? 'bg-gray-700' : 'bg-[#e9ebef]'
            }`}
            style={pillTransitionStyle}
          />
        )}

        {tabs.map(({ path, icon: Icon, label, strokeWidth }, i) => (
          <Link
            key={path}
            to={path}
            ref={el => { tabRefs.current[i] = el; }}
            className="relative flex flex-col items-center justify-center gap-[4px] px-4 py-[6px] h-full z-10 rounded-[8px]"
          >
            <Icon
              className={`size-5 ${
                isActive(path)
                  ? darkMode ? 'text-blue-400' : 'text-black'
                  : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
              }`}
              strokeWidth={strokeWidth}
            />
            <span className={`text-[13px] font-['Segoe_UI'] whitespace-nowrap ${
              isActive(path)
                ? darkMode ? 'text-blue-400' : 'text-black'
                : darkMode ? 'text-gray-400' : 'text-[#9f9f9f]'
            }`}>
              {label}
            </span>
          </Link>
        ))}

        <button
          onClick={handleLeaveGroup}
          disabled={leavingGroup}
          className={`relative flex flex-col items-center justify-center gap-[4px] px-4 py-[6px] h-full z-10 rounded-[8px] transition-colors ${
            darkMode
              ? 'text-gray-400 hover:text-red-400'
              : 'text-[#9f9f9f] hover:text-red-600'
          } ${leavingGroup ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Leave group"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span className="text-[13px] font-['Segoe_UI'] whitespace-nowrap">Leave</span>
        </button>
      </div>
    </div>
  );
}
