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
  onAuthChange: (user: any) => void;
  selectedGroup: Group | null;
}

export function BottomNav({ isAdmin, onLeaveGroup, onAuthChange, selectedGroup }: BottomNavProps) {
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

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      const activeEl = tabRefs.current[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeIndex, isDesktop, location.pathname]);

  useEffect(() => {
    const activeEl = tabRefs.current[activeIndex];
    if (!activeEl) return;
    const parent = activeEl.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    if (isDesktop) {
      setPillStyle({ offset: elRect.top - parentRect.top, size: elRect.height });
    } else {
      setPillStyle({ offset: elRect.left - parentRect.left, size: elRect.width });
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
        <div
          className={`fixed left-0 top-0 z-50 flex h-full flex-col gap-3 overflow-hidden px-3 py-5 ${darkMode ? 'border-r border-slate-800/80 bg-slate-900/80' : 'border-r border-slate-200/80 bg-white/80'} backdrop-blur-xl`}
          style={{ width: sidebarOpen ? '220px' : '74px', transition: 'width 300ms ease-out' }}
        >
          <div className="mb-2 flex min-w-0 items-center px-2" style={{ justifyContent: sidebarOpen ? 'space-between' : 'center' }}>
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 text-white shadow-lg shadow-cyan-500/20">
      
                 <img src='src/app/context/Logo.png' className="h-auto w-3/4" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>CAST</p>
                  <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Attendance</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setSidebarOpen(prev => !prev)}
              className={`shrink-0 rounded-xl p-2 transition ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
            </button>
          </div>

          <div className="relative flex flex-1 flex-col gap-1">
            {activeIndex >= 0 && pillStyle.size > 0 && (
              <div className={`absolute inset-x-0 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-slate-100/90'}`} style={pillTransitionStyle} />
            )}

            {tabs.map(({ path, icon: Icon, label, strokeWidth }, i) => (
              <Link
                key={path}
                to={path}
                ref={el => { tabRefs.current[i] = el; }}
                className="relative z-10 flex items-center gap-3 rounded-2xl px-3 py-3"
                style={{ minWidth: 0 }}
              >
                <Icon className={`size-5 shrink-0 ${isActive(path) ? (darkMode ? 'text-cyan-300' : 'text-blue-600') : darkMode ? 'text-slate-400' : 'text-slate-500'}`} strokeWidth={strokeWidth} />
                <span className={`overflow-hidden text-sm font-medium whitespace-nowrap ${isActive(path) ? (darkMode ? 'text-cyan-300' : 'text-slate-900') : darkMode ? 'text-slate-400' : 'text-slate-500'}`} style={{ opacity: sidebarOpen ? 1 : 0, maxWidth: sidebarOpen ? '200px' : '0px', transition: 'opacity 200ms ease-out, max-width 300ms ease-out' }}>
                  {label}
                </span>
              </Link>
            ))}
          </div>

          <button
            onClick={handleLeaveGroup}
            disabled={leavingGroup}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-rose-300' : 'text-slate-500 hover:bg-slate-100 hover:text-rose-600'} ${leavingGroup ? 'cursor-not-allowed opacity-50' : ''}`}
            aria-label="Leave group"
          >
            <LogOut size={18} strokeWidth={1.8} />
            {sidebarOpen && <span className="text-sm font-medium">{leavingGroup ? 'Leaving...' : 'Leave Group'}</span>}
          </button>
        </div>

        <div style={{ width: sidebarOpen ? '220px' : '74px', flexShrink: 0, transition: 'width 300ms ease-out' }} />
      </>
    );
  }

  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 border-t ${darkMode ? 'border-slate-800/80 bg-slate-900/85' : 'border-slate-200/80 bg-white/85'} backdrop-blur-xl`}>
      <div className="mx-auto flex h-[74px] max-w-[560px] items-center overflow-x-auto overflow-y-hidden px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative flex h-full min-w-max items-center gap-1">
          {activeIndex >= 0 && pillStyle.size > 0 && (
            <div className={`absolute top-2 bottom-2 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-slate-100/90'}`} style={pillTransitionStyle} />
          )}

          {tabs.map(({ path, icon: Icon, label, strokeWidth }) => (
            <Link key={path} to={path} ref={el => { tabRefs.current[tabs.findIndex(tab => tab.path === path)] = el; }} className="relative z-10 flex h-full shrink-0 flex-col items-center justify-center gap-[4px] min-w-[72px] rounded-2xl px-3 py-2">
              <Icon className={`size-5 ${isActive(path) ? (darkMode ? 'text-cyan-300' : 'text-blue-600') : darkMode ? 'text-slate-400' : 'text-slate-500'}`} strokeWidth={strokeWidth} />
              <span className={`text-[12px] font-medium whitespace-nowrap ${isActive(path) ? (darkMode ? 'text-cyan-300' : 'text-slate-900') : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {label}
              </span>
            </Link>
          ))}

          <button onClick={handleLeaveGroup} disabled={leavingGroup} className={`relative z-10 flex h-full shrink-0 flex-col items-center justify-center gap-[4px] min-w-[72px] rounded-2xl px-3 py-2 transition ${darkMode ? 'text-slate-400 hover:text-rose-300' : 'text-slate-500 hover:text-rose-600'} ${leavingGroup ? 'cursor-not-allowed opacity-50' : ''}`} aria-label="Leave group">
            <LogOut size={18} strokeWidth={1.8} />
            <span className="text-[12px] font-medium">Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
}
