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

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
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

  try {
    const sourceGroup = await getDefaultGroupId();
    if (sourceGroup) {
      await seedGroupEntries(data.id, sourceGroup);
    }
  } catch (seedError) {
    console.error('Group created but seeding default attendance failed:', seedError);
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

async function getDefaultGroupId() {
  const { data, error } = await supabase
    .from('attendance_entries')
    .select('group_id')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.group_id as string | null;
}

async function seedGroupEntries(targetGroupId: string, sourceGroupId: string) {
  const { data, error } = await supabase
    .from('attendance_entries')
    .select('*')
    .eq('group_id', sourceGroupId);

  if (error || !data || data.length === 0) {
    return;
  }

  const clonedRows = data.map((row: any) => ({
    date: row.date,
    attendance: row.attendance,
    year: row.year,
    month: row.month,
    week: row.week,
    lag1: row.lag1,
    lag4: row.lag4,
    roll4: row.roll4,
    delta1: row.delta1,
    delta4: row.delta4,
    is_summer: row.is_summer,
    is_holiday_season: row.is_holiday_season,
    church_event: row.church_event,
    is_fast_sunday: row.is_fast_sunday,
    low_temp: row.low_temp,
    high_temp: row.high_temp,
    rainfall: row.rainfall,
    snowfall: row.snowfall,
    created_by: row.created_by,
    group_id: targetGroupId,
  }));

  await supabase.from('attendance_entries').insert(clonedRows);
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

export async function joinGroup(userId: string, groupId: string, userEmail: string) {
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
