import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Alert } from './ui/alert';
import { getGroupByJoinCode, createGroup, joinGroup } from '../../lib/supabase';
import type { Group } from '../hooks/useAttendanceData';

interface GroupSelectorProps {
  user: any;
  isAdmin: boolean;
  onGroupSelected: (group: Group) => void;
}

const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export function GroupSelector({ user, isAdmin, onGroupSelected }: GroupSelectorProps) {
  const [joinCode, setJoinCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      await joinGroup(user.id, group.id, user.email);
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

      await joinGroup(user.id, group.id, user.email);
      setSuccess(`Group created successfully. Join code: ${group.joinCode}`);
      onGroupSelected(group);
    } catch (err: any) {
      setError(err?.message || 'Unable to create the group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-3xl">
        <Card className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Select a Group</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Enter a join code to join the group. Admins can also create a group with a random join code.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">{error}</Alert>
          )}

          {success && (
            <Alert variant="default">{success}</Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Join an Existing Group</h2>
              <form onSubmit={handleJoin} className="space-y-4">
                <Input
                  placeholder="Enter join code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  autoCapitalize="characters"
                />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Joining…' : 'Join Group'}
                </Button>
              </form>
            </div>

            {isAdmin ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Create a Group</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Input
                    placeholder="Group name"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={loading} className="w-full">
                    {loading ? 'Creating…' : 'Create Group'}
                  </Button>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    A random join code will be generated automatically for the new group.
                  </p>
                </form>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
