import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Check .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signUp(email: string, password: string, fullName?: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: fullName?.trim()
      ? { data: { full_name: fullName.trim() } }
      : undefined,
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Resolves the display name attendance entries are stamped with
 * (profile full name, falling back to email). Attendance rows store
 * this same value in `created_by`, so any lookup/delete against that
 * column must resolve identity the same way or it will silently match
 * nothing.
 */
export async function getCurrentUserFullName(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return 'Unknown';

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .single();

  return profile?.full_name ?? user.email ?? 'Unknown';
}

export async function deleteCurrentAccount(confirmationWord: string) {
  if (confirmationWord.trim().toUpperCase() !== 'DELETE') {
    throw new Error('Please type DELETE to confirm account deletion.');
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('You must be signed in to delete your account.');
  }

  const userId = user.id;
  // attendance_entries.created_by stores the display name resolved by
  // getCurrentUserFullName (email is only a fallback for users with no
  // profile name), so that's what deletion must match against.
  const createdByValue = await getCurrentUserFullName();

  const cleanupTasks = [
    supabase.from('group_members').delete().eq('user_id', userId),
    supabase.from('user_profiles').delete().eq('user_id', userId),
    supabase.from('admins').delete().eq('user_id', userId),
  ];

  if (createdByValue && createdByValue !== 'Unknown') {
    cleanupTasks.push(supabase.from('attendance_entries').delete().eq('created_by', createdByValue));
  }

  const results = await Promise.all(cleanupTasks);
  const firstError = results.find(result => result.error)?.error;
  if (firstError) {
    throw firstError;
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    throw signOutError;
  }

  return true;
}

export async function saveUserProfile(fullName: string, userId?: string, email?: string | null) {
  const trimmedName = fullName.trim();
  if (!trimmedName) return null;

  const currentUser = await getCurrentUser();
  const resolvedUserId = userId ?? currentUser?.id;

  if (!resolvedUserId) return null;

  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: resolvedUserId, full_name: trimmedName },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('Error saving user profile row:', error);
  }

  try {
    await supabase.auth.updateUser({ data: { full_name: trimmedName } });
  } catch (error) {
    console.error('Error updating auth metadata:', error);
  }

  return true;
}

export async function getProfilesForUserIds(userIds: string[]) {
  if (!userIds.length) return [];

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading user profile rows:', error);
    return [];
  }
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function checkIsAdmin(userId: string) {
  const { data } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();
  return !!data;
}

function normalizeGroup(group: any) {
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    joinCode: group.join_code ?? group.joinCode,
    createdBy: group.created_by ?? group.createdBy,
    createdAt: group.created_at ?? group.createdAt,
  };
}

export async function getGroupByJoinCode(joinCode: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('join_code', joinCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeGroup(data);
}

export async function createGroup(name: string, joinCode: string, createdBy: string | null) {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name,
      join_code: joinCode,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeGroup(data);
}

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('attendance_entries')
    .select('created_by')
    .eq('group_id', groupId)
    .not('created_by', 'is', null)
    .order('created_by', { ascending: true });

  if (error) {
    throw error;
  }

  return Array.from(new Set((data ?? []).map((row: any) => row.created_by))).filter(
    (email: string | null) => !!email
  );
}

export async function getUserGroup(userId: string) {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', data.group_id)
      .single();

    if (groupError) throw groupError;
    return normalizeGroup(groupData);
  } catch (error) {
    console.error('Error getting user group:', error);
    return null;
  }
}

export async function getUserProfilesForGroup(groupId: string): Promise<Record<string, string>> {
  // Get all user_ids in this group
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  if (membersError || !members) return {};

  const userIds = members.map((m) => m.user_id);

  // Pull full_name from user_profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', userIds);

  if (profilesError || !profiles) return {};

  return Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name]));
}

export async function joinGroup(userId: string, groupId: string) {
  try {
    const { error } = await supabase
      .from('group_members')
      .upsert(
        { user_id: userId, group_id: groupId, joined_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('Error joining group:', error);
    throw error;
  }
}

export async function leaveGroup(userId: string) {
  try {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error leaving group:', error);
    throw error;
  }
}

export async function removeUserFromGroup(userId: string) {
  try {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error removing user from group:', error);
    throw error;
  }
}

export async function getGroupMembersWithDetails(groupId: string) {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting group members:', error);
    return [];
  }
}

export async function getUserEmailsForGroup(groupId: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('attendance_entries')
      .select('created_by')
      .eq('group_id', groupId)
      .not('created_by', 'is', null);

    if (error) throw error;

    const emailMap: Record<string, string> = {};
    if (data) {
      data.forEach((row: any) => {
        if (row.created_by) {
          emailMap[row.created_by] = row.created_by;
        }
      });
    }
    return emailMap;
  } catch (error) {
    console.error('Error getting user emails:', error);
    return {};
  }

  
}
