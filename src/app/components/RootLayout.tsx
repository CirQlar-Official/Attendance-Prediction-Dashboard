import { Outlet } from 'react-router';
import { useState, useEffect } from 'react';
import { getCurrentUser, checkIsAdmin, getUserGroup } from '../../lib/supabase';
import { BottomNav } from './BottomNav';
import { Auth } from './Auth';
import { GroupSelector } from './GroupSelector';
import { Toaster } from './ui/sonner';

import type { Group } from '../hooks/useAttendanceData';

export function RootLayout() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const checkAdmin = async () => {
      const adminStatus = await checkIsAdmin(user.id);
      setIsAdmin(adminStatus);
    };

    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSelectedGroup(null);
      return;
    }

    const loadUserGroup = async () => {
      const userGroup = await getUserGroup(user.id);
      setSelectedGroup(userGroup);
    };

    loadUserGroup();
  }, [user]);

  const handleAuthChange = (nextUser: any) => {
    setUser(nextUser);
    if (!nextUser) {
      setIsAdmin(false);
      setSelectedGroup(null);
    }
  };

  const handleGroupSelected = (group: Group) => {
    setSelectedGroup(group);
  };

  const handleLeaveGroup = () => {
    setSelectedGroup(null);
  };

  if (loading) {
    return (
      <div className="app-page-shell items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_55%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] text-slate-900 dark:bg-none dark:bg-slate-950 dark:text-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Loading CAST</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-page-shell bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.14),_transparent_55%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] text-slate-900 dark:bg-none dark:bg-slate-950 dark:text-slate-100">
        <Toaster />
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
          <Auth user={user} onAuthChange={handleAuthChange} />
        </div>
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="app-page-shell bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_55%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] text-slate-900 dark:bg-none dark:bg-slate-950 dark:text-slate-100">
        <Toaster />
        <GroupSelector user={user} isAdmin={isAdmin} onGroupSelected={handleGroupSelected} onAuthChange={handleAuthChange} />
      </div>
    );
  }

  return (
    <div className="app-page-shell flex-col bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_35%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_100%)] text-slate-900 dark:bg-none dark:bg-slate-950 dark:text-slate-100 md:flex-row">
      <Toaster />
      <BottomNav isAdmin={isAdmin} onLeaveGroup={handleLeaveGroup} />
      <div className="flex-1 min-h-0 min-w-0 overflow-auto pb-[78px] md:pb-0">
        <Outlet context={{ user, isAdmin, selectedGroup }} />
      </div>
    </div>
  );
}
