import { Outlet } from 'react-router';

import { useState, useEffect } from 'react';

import { getCurrentUser, checkIsAdmin, getUserGroup } from '../../lib/supabase';

import { useDarkMode } from '../context/DarkModeContext';

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
  const { darkMode } = useDarkMode();

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
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} flex flex-col items-center justify-center h-full w-full`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} flex flex-col items-center justify-center h-full w-full p-4`}>
        <Toaster />
        <Auth user={user} onAuthChange={handleAuthChange} />
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} min-h-full w-full`}>
        <Toaster />
        <GroupSelector user={user} isAdmin={isAdmin} onGroupSelected={handleGroupSelected} />
      </div>
    );
  }

  return (
    // On desktop (md+): flex-row so sidebar and content sit side by side.
    // On mobile: flex-col, BottomNav is fixed so it doesn't affect flow.
    <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} flex flex-col md:flex-row h-full w-full`}>
      <Toaster />
      <BottomNav isAdmin={isAdmin} onLeaveGroup={handleLeaveGroup} selectedGroup={selectedGroup} />
      <div className="flex-1 min-h-0 min-w-0 overflow-auto flex flex-col animate-fadeIn pb-[70px] md:pb-0">
        <Outlet context={{ user, darkMode, isAdmin, selectedGroup }} />
      </div>
    </div>
  );
}
