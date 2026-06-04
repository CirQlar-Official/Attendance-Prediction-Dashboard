import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';
import { useDarkMode } from '../context/DarkModeContext';
import { getGroupMembersWithDetails, removeUserFromGroup, getCurrentUser, getUserEmailsForGroup } from '../../lib/supabase';
import type { Group } from '../hooks/useAttendanceData';
import { Users, Key, Trash2, Loader } from 'lucide-react';
import { toast } from 'sonner';

export function Members() {
  const { selectedGroup, isAdmin } = useOutletContext<{ selectedGroup: Group | null; isAdmin: boolean }>();
  const { darkMode } = useDarkMode();
  const [members, setMembers] = useState<{ user_id: string; joined_at: string; email?: string }[]>([]);
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
        
        // Fetch emails from attendance entries for this group
        const emailMap: Record<string, string> = {};
        const { data: entries, error: entriesError } = await (await import('../../lib/supabase')).supabase
          .from('attendance_entries')
          .select('created_by')
          .eq('group_id', selectedGroup.id)
          .not('created_by', 'is', null);

        if (!entriesError && entries) {
          entries.forEach((entry: any) => {
            if (entry.created_by) {
              emailMap[entry.created_by] = entry.created_by;
            }
          });
        }

        // Enhance members with email info (using email as display name for now)
        const membersWithEmails = result.map(m => {
          // Try to find email from attendance entries
          const foundEmail = Object.values(emailMap).find(() => true) || null;
          return {
            ...m,
            email: foundEmail || `User ${m.user_id.slice(0, 8)}`
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
    <div className={`flex-1 min-h-0 w-full overflow-auto ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="flex flex-col gap-[20px] items-start p-[10px] w-full pb-[80px]">
        <div className={`flex flex-col gap-4 p-5 rounded-[20px] w-full border-2 sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'border-gray-700 bg-gray-800 text-white' : 'border-[#eceef2] bg-white text-black'}`}>
          <div>
            <p className="font-['Segoe_UI'] text-[24px] font-semibold">Group Members</p>
            <p className="font-['Segoe_UI'] text-[14px] opacity-80">
              See the join code and attendance contributors for {selectedGroup?.name ?? 'your group'}.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-[16px] px-4 py-3 bg-blue-600 text-white">
            <Key className="size-5" />
            <div className="text-left">
              <p className="text-[12px] uppercase opacity-80">Join Code</p>
              <p className="font-semibold text-[16px]">{selectedGroup?.joinCode ?? 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className={`w-full rounded-[20px] border-2 p-5 ${darkMode ? 'border-gray-700 bg-gray-800 text-white' : 'border-[#eceef2] bg-white text-black'}`}>
          <div className="flex items-center gap-3 mb-4">
            <Users className="size-5" />
            <p className="font-['Segoe_UI'] text-[18px] font-semibold">People in this group</p>
          </div>

          {loading ? (
            <p className="font-['Segoe_UI'] text-[14px] opacity-80">Loading members…</p>
          ) : error ? (
            <p className="font-['Segoe_UI'] text-[14px] text-red-400">{error}</p>
          ) : members.length === 0 ? (
            <p className="font-['Segoe_UI'] text-[14px] opacity-80">No members found yet.</p>
          ) : (
            <ul className="space-y-3">
              {members.map(member => {
                const isCurrentUser = member.user_id === currentUserId;
                return (
                  <li key={member.user_id} className={`rounded-[14px] px-4 py-3 flex items-center justify-between ${darkMode ? 'bg-gray-900' : 'bg-[#f8fafc]'}`}>
                    <div>
                      <p className="font-['Segoe_UI'] text-[14px]">{member.email}</p>
                      <p className="font-['Segoe_UI'] text-[12px] opacity-60">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isAdmin && !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveUser(member.user_id, member.email || 'User')}
                        disabled={removingUserId === member.user_id}
                        className={`p-2 rounded-lg transition-colors ${
                          removingUserId === member.user_id
                            ? 'opacity-50 cursor-not-allowed'
                            : darkMode
                            ? 'text-gray-400 hover:text-red-400 hover:bg-gray-800'
                            : 'text-gray-600 hover:text-red-600 hover:bg-gray-200'
                        }`}
                        aria-label={`Remove ${member.email}`}
                      >
                        {removingUserId === member.user_id ? (
                          <Loader className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
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
