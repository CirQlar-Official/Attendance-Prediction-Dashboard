import { Outlet } from 'react-router';

import { useState, useEffect } from 'react';

import { getCurrentUser, checkIsAdmin } from '../../lib/supabase';

import { useDarkMode } from '../context/DarkModeContext';

import { BottomNav } from './BottomNav';

import { Auth } from './Auth';

import { Toaster } from './ui/sonner';


export function RootLayout() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { darkMode } = useDarkMode();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (currentUser) {
          const adminStatus = await checkIsAdmin(currentUser.id);
          setIsAdmin(adminStatus);
        }
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

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
        <Auth user={user} onAuthChange={setUser} />
      </div>
    );
  }

  return (
    // On desktop (md+): flex-row so sidebar and content sit side by side.
    // On mobile: flex-col, BottomNav is fixed so it doesn't affect flow.
    <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} flex flex-col md:flex-row h-full w-full`}>
      <Toaster />
      <BottomNav isAdmin={isAdmin} />
      <div className="flex-1 min-h-0 min-w-0 overflow-auto flex flex-col animate-fadeIn pb-[70px] md:pb-0">
        <Outlet context={{ user, darkMode, isAdmin }} />
      </div>
    </div>
  );
}
