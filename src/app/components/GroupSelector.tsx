"use client";

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert } from './ui/alert';
import { Sparkles, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getGroupByJoinCode, createGroup, joinGroup, deleteCurrentAccount } from '../../lib/supabase';
import type { Group } from '../hooks/useAttendanceData';
import { SmoothInput } from './ui/input';

// ==========================================
// Types & Shared Config for Smooth Inputs
// ==========================================
interface GroupSelectorProps {
  user: any;
  isAdmin: boolean;
  onGroupSelected: (group: Group) => void;
  onAuthChange: (user: any) => void;
}

const inputWrapperClassName = cn(
  "bg-muted2 has-[:focus-visible]:outline-muted3 relative w-full rounded-2xl p-4",
  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
);

// ==========================================
// Helper Utility
// ==========================================
const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ==========================================
// Main Combined Component
// ==========================================
export function GroupSelector({ user, isAdmin, onGroupSelected, onAuthChange }: GroupSelectorProps) {
  const [joinCode, setJoinCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) {
        setError('Enter a valid join code.');
        return;
      }

      const group = await getGroupByJoinCode(code);
      if (!group) {
        setError('No group was found for that join code.');
        return;
      }

      await joinGroup(user.id, group.id);
      onGroupSelected(group);
    } catch (err: any) {
      setError(err?.message || 'Unable to join the group.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const name = groupName.trim() || 'New Group';
      const code = generateJoinCode();
      const group = await createGroup(name, code, user?.id);

      if (!group) {
        setError('The newly created group could not be loaded.');
        return;
      }

      await joinGroup(user.id, group.id);
      setSuccess(`Group created successfully. Join code: ${group.joinCode}`);
      onGroupSelected(group);
    } catch (err: any) {
      setError(err?.message || 'Unable to create the group.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError(null);
    setSuccess(null);

    const confirmation = window.prompt('Type DELETE to confirm account deletion. This action is permanent.');

    if (confirmation?.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion.');
      return;
    }

    setDeletingAccount(true);

    try {
      await deleteCurrentAccount('DELETE');
      onAuthChange(null);
      setSuccess('Account deleted.');
    } catch (err: any) {
      setError(err?.message || 'Unable to delete your account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl">
        <Card className="app-shell-card-strong border-0 p-0 shadow-none">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 p-8 text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                <Sparkles className="size-4" />
                CAST
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Choose your group and get moving.</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-blue-50">Join an existing group with a code or create a new one.</p>
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                  <img src='src/app/context/Logo.png' className="h-auto w-3/4" alt="Logo" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Connected groups</p>
                  <p className="text-sm text-blue-50">Everything stays in one shared place</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {error && <Alert variant="destructive" className="mb-5">{error}</Alert>}
              {success && <Alert variant="default" className="mb-5">{success}</Alert>}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="app-section-label">Join</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Enter a join code</h2>
                  </div>
                  <form onSubmit={handleJoin} className="space-y-4">
                    <SmoothInput
                      placeholder="Enter join code"
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value)}
                      autoCapitalize="characters"
                      wrapperClassName={inputWrapperClassName}
                    />
                    <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400">
                      {loading ? 'Joining…' : 'Join group'}
                    </Button>
                  </form>
                </div>

                {isAdmin ? (
                  <div className="space-y-4">
                    <div>
                      <p className="app-section-label">Create</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Start a new group</h2>
                    </div>
                    <form onSubmit={handleCreate} className="space-y-4">
                      <SmoothInput
                        placeholder="Group name"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        wrapperClassName={inputWrapperClassName}
                      />
                      <Button type="submit" variant="secondary" disabled={loading} className="w-full">
                        {loading ? 'Creating…' : 'Create group'}
                      </Button>
                      <p className="text-sm text-slate-500 dark:text-slate-400">A random join code will be generated automatically for the new group.</p>
                    </form>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 rounded-[20px] border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 size-5 text-rose-600 dark:text-rose-300" />
                  <div>
                    <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-200">Delete account</h3>
                    <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-200/80">Type DELETE in the confirmation prompt to permanently remove your account data and sign out.</p>
                  </div>
                </div>
                <Button type="button" variant="destructive" disabled={deletingAccount} onClick={handleDeleteAccount} className="mt-4 w-full">
                  {deletingAccount ? 'Deleting…' : 'Delete account'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}