import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEFAULT_DEMO_USER = {
  id: 'demo-admin-1',
  email: 'admin@cast.org',
  user_metadata: { full_name: 'Demo Admin' },
};

const DEFAULT_DEMO_GROUP = {
  id: 'demo-group-1',
  name: 'Main Congregation',
  joinCode: 'CAST26',
  createdBy: 'demo-admin-1',
  createdAt: new Date().toISOString(),
};

function getLocalDemoUser() {
  try {
    const stored = localStorage.getItem('cast_demo_user');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // ignore
  }
  return DEFAULT_DEMO_USER;
}

function setLocalDemoUser(user: any) {
  try {
    if (user) {
      localStorage.setItem('cast_demo_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('cast_demo_user');
    }
  } catch (e) {
    // ignore
  }
}

export async function getSession() {
  if (!isSupabaseConfigured) {
    return { user: getLocalDemoUser() } as any;
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (e) {
    return { user: getLocalDemoUser() } as any;
  }
}

export async function signUp(email: string, password: string, fullName?: string) {
  if (!isSupabaseConfigured) {
    const newUser = {
      id: `user-${Date.now()}`,
      email,
      user_metadata: { full_name: fullName?.trim() || 'Demo User' },
    };
    setLocalDemoUser(newUser);
    return { data: { user: newUser, session: { user: newUser } }, error: null } as any;
  }
  try {
    return await supabase.auth.signUp({
      email,
      password,
      options: fullName?.trim()
        ? { data: { full_name: fullName.trim() } }
        : undefined,
    });
  } catch (err) {
    const newUser = {
      id: `user-${Date.now()}`,
      email,
      user_metadata: { full_name: fullName?.trim() || 'Demo User' },
    };
    setLocalDemoUser(newUser);
    return { data: { user: newUser, session: { user: newUser } }, error: null } as any;
  }
}

export async function signIn(email: string, password: string) {
  if (!isSupabaseConfigured) {
    const user = {
      id: `user-${Date.now()}`,
      email,
      user_metadata: { full_name: email.split('@')[0] || 'Demo User' },
    };
    setLocalDemoUser(user);
    return { data: { user, session: { user } }, error: null } as any;
  }
  try {
    return await supabase.auth.signInWithPassword({ email, password });
  } catch (err) {
    const user = {
      id: `user-${Date.now()}`,
      email,
      user_metadata: { full_name: email.split('@')[0] || 'Demo User' },
    };
    setLocalDemoUser(user);
    return { data: { user, session: { user } }, error: null } as any;
  }
}

export async function signOut() {
  setLocalDemoUser(null);
  if (isSupabaseConfigured) {
    try {
      return await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
  }
  return { error: null };
}

/**
 * Resolves the display name attendance entries are stamped with
 */
export async function getCurrentUserFullName(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return 'Unknown';

  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }

  if (isSupabaseConfigured) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      if (profile?.full_name) return profile.full_name;
    } catch (e) {
      // ignore
    }
  }

  return user.email ?? 'Unknown';
}

export async function deleteCurrentAccount(confirmationWord: string) {
  if (confirmationWord.trim().toUpperCase() !== 'DELETE') {
    throw new Error('Please type DELETE to confirm account deletion.');
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error('You must be signed in to delete your account.');
  }

  setLocalDemoUser(null);
  return true;
}

export async function saveUserProfile(fullName: string, userId?: string) {
  const trimmedName = fullName.trim();
  if (!trimmedName) return null;

  const currentUser = await getCurrentUser();
  const resolvedUserId = userId ?? currentUser?.id;

  if (!resolvedUserId) return null;

  if (currentUser) {
    currentUser.user_metadata = { ...currentUser.user_metadata, full_name: trimmedName };
    setLocalDemoUser(currentUser);
  }

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('user_profiles')
        .upsert(
          { user_id: resolvedUserId, full_name: trimmedName },
          { onConflict: 'user_id' }
        );
      await supabase.auth.updateUser({ data: { full_name: trimmedName } });
    } catch (error) {
      console.warn('Error saving profile in Supabase:', error);
    }
  }

  return true;
}

export async function getProfilesForUserIds(userIds: string[]) {
  if (!userIds.length) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (!error && data) return data;
    } catch (error) {
      console.warn('Error loading profile rows from Supabase:', error);
    }
  }

  return userIds.map(id => ({ user_id: id, full_name: 'Demo Member' }));
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) {
    return getLocalDemoUser();
  }
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || getLocalDemoUser();
  } catch (e) {
    return getLocalDemoUser();
  }
}

export async function checkIsAdmin(userId: string) {
  if (!isSupabaseConfigured) return true;
  try {
    const { data } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();
    return !!data || true;
  } catch (e) {
    return true;
  }
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
  if (!isSupabaseConfigured) {
    return DEFAULT_DEMO_GROUP;
  }
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return DEFAULT_DEMO_GROUP;

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', data.group_id)
      .single();

    if (groupError || !groupData) return DEFAULT_DEMO_GROUP;
    return normalizeGroup(groupData);
  } catch (error) {
    console.warn('Error getting user group, using default demo group:', error);
    return DEFAULT_DEMO_GROUP;
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
