import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';
import { getGroupMembersWithDetails, removeUserFromGroup, getCurrentUser, getProfilesForUserIds } from '../../lib/supabase';
import type { Group } from '../hooks/useAttendanceData';
import { Users, Key, Trash2, Loader, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface MemberRow {
  user_id: string;
  joined_at: string;
  email?: string;
  full_name?: string;
  displayName?: string;
}

export function Members() {
  const { selectedGroup, isAdmin } = useOutletContext<{ selectedGroup: Group | null; isAdmin: boolean }>();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const user = await getCurrentUser();
      setCurrentUserId(user?.id ?? null);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!selectedGroup?.id) return;

    const loadMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getGroupMembersWithDetails(selectedGroup.id);
        
        const memberIds = result.map(m => m.user_id);
        const profileRows = await getProfilesForUserIds(memberIds);
        const profileById = new Map(profileRows.map((profile: any) => [profile.user_id, profile]));

        const membersWithEmails = result.map(m => {
          const profile = profileById.get(m.user_id);
          return {
            ...m,
            email: profile?.full_name || `User ${m.user_id.slice(0, 8)}`,
            displayName: profile?.full_name || `User ${m.user_id.slice(0, 8)}`,
          };
        });

        setMembers(membersWithEmails);
      } catch (err: any) {
        setError(err?.message || 'Unable to load group members.');
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [selectedGroup]);

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from the group? They can rejoin with the code later.`)) {
      return;
    }

    setRemovingUserId(userId);
    try {
      await removeUserFromGroup(userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success(`${email} has been removed from the group.`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove user.');
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <div className="min-h-full w-full overflow-auto px-3 py-3 pb-24 text-slate-900 dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="app-shell-card-strong overflow-hidden p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <Sparkles className="size-3.5" />
                Members
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">Group members</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">See the join code and the people contributing to {selectedGroup?.name ?? 'your group'}.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[24px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-200">
              <Key className="size-5" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">Join code</p>
                <p className="text-lg font-semibold">{selectedGroup?.joinCode ?? 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-shell-card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <Users className="size-5 text-cyan-500" />
            <div>
              <p className="app-section-label">People</p>
              <h2 className="mt-1 text-lg font-semibold">People in this group</h2>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader className="size-4 animate-spin" />Loading members…</div>
          ) : error ? (
            <p className="text-sm text-rose-500">{error}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-500">No members found yet.</p>
          ) : (
            <ul className="space-y-3">
              {members.map(member => {
                const isCurrentUser = member.user_id === currentUserId;
                return (
                  <li key={member.user_id} className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                    <div>
                      <p className="text-sm font-semibold">{member.full_name || member.email}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                    </div>
                    {isAdmin && !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveUser(member.user_id, member.email || 'User')}
                        disabled={removingUserId === member.user_id}
                        className={`rounded-2xl p-2 transition text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400 ${removingUserId === member.user_id ? 'cursor-not-allowed opacity-50' : ''}`}
                        aria-label={`Remove ${member.email}`}
                      >
                        {removingUserId === member.user_id ? <Loader className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
