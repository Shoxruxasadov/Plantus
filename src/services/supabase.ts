import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hjrgwzwxoiaeqwjueczd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqcmd3end4b2lhZXF3anVlY3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NDcxNjAsImV4cCI6MjA4NDAyMzE2MH0.uLp-9zdGVgZSfrzICu6J6c_J6bE5qpqjVCI1oOLDJfk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database helper functions
export const usersTable = () => supabase.from('users');
export const gardenTable = () => supabase.from('garden');
export const groupsTable = () => supabase.from('groups');
export const aiTable = () => supabase.from('ai');
export const articleTable = () => supabase.from('article');
export const plantsTable = () => supabase.from('plants');
export const snapsTable = () => supabase.from('snaps');
export const notificationsTable = () => supabase.from('notifications');
export const subscriptionsTable = () => supabase.from('subscriptions');
export const invoicesTable = () => supabase.from('invoices');
export const supportTable = () => supabase.from('support');

// Auth helper functions
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { data: null, error: authError };
  }

  // Create user record in users table
  if (authData.user) {
    const { error: userError } = await usersTable().insert({
      id: authData.user.id,
      email: email,
      name: name,
      created_at: new Date().toISOString(),
    });

    if (userError) {
      console.error('Error creating user record:', userError);
    }

    // Create default "General" group (cannot be deleted)
    const { error: groupError } = await groupsTable().insert({
      name: 'General',
      user: authData.user.id,
      created_at: new Date().toISOString(),
      deletemode: false,
    });

    if (groupError) {
      console.error('Error creating default group:', groupError);
    }
  }

  return { data: authData, error: authError };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/** Deep link for password reset – add this URL to Supabase Dashboard → Auth → URL Configuration → Redirect URLs (e.g. plantus://reset-password) */
const PASSWORD_RESET_REDIRECT = 'plantus://reset-password';

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT,
  });
  return { data, error };
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// User data functions
export const getUserData = async (userId: string) => {
  const { data, error } = await usersTable()
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
};

export const updateUserData = async (userId: string, updates: any) => {
  const { data, error } = await usersTable()
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
};

const USER_AVATAR_BUCKET = 'users';

/** Decode base64 to ArrayBuffer for Supabase storage upload (RN-compatible). */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Upload avatar image to bucket "users" and set users.image to public URL.
 * @param userId - auth user id
 * @param base64 - image data (e.g. from ImagePicker with base64: true)
 * @param mimeType - e.g. 'image/jpeg' or 'image/png'
 */
export const uploadUserAvatar = async (
  userId: string,
  base64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ data: string | null; error: any }> => {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/avatar.${ext}`;
  try {
    const arrayBuffer = base64ToArrayBuffer(base64);
    const { error: uploadError } = await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .upload(path, arrayBuffer, { contentType: mimeType, upsert: true });
    if (uploadError) return { data: null, error: uploadError };
    const { data: urlData } = supabase.storage.from(USER_AVATAR_BUCKET).getPublicUrl(path);
    const publicUrl = urlData?.publicUrl ?? null;
    if (publicUrl) {
      const { error: updateError } = await usersTable().update({ image: publicUrl }).eq('id', userId);
      if (updateError) return { data: publicUrl, error: updateError };
    }
    return { data: publicUrl, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
};

/**
 * Remove user avatar: set users.image to null and delete file from bucket "users".
 */
export const removeUserAvatar = async (userId: string): Promise<{ error: any }> => {
  const { data: user } = await usersTable().select('image').eq('id', userId).single();
  const { error: updateError } = await usersTable().update({ image: null }).eq('id', userId);
  if (updateError) return { error: updateError };
  if (user?.image) {
    await supabase.storage
      .from(USER_AVATAR_BUCKET)
      .remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`]);
  }
  return { error: null };
};

// Garden functions
export const getGardenPlants = async (userId: string) => {
  const { data, error } = await gardenTable()
    .select('*')
    .eq('user', userId)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const addPlantToGarden = async (plantData: any) => {
  const { data, error } = await gardenTable()
    .insert(plantData)
    .select()
    .single();
  return { data, error };
};

export const updateGardenPlant = async (plantId: string, updates: any) => {
  const { data, error } = await gardenTable()
    .update(updates)
    .eq('id', plantId)
    .select()
    .single();
  return { data, error };
};

export const getGardenPlantById = async (plantId: string) => {
  const { data, error } = await gardenTable()
    .select('*')
    .eq('id', plantId)
    .single();
  return { data, error };
};

export const deleteGardenPlant = async (plantId: string) => {
  const { error } = await gardenTable()
    .delete()
    .eq('id', plantId);
  return { error };
};

// Groups functions
export const getGroups = async (userId: string) => {
  const { data, error } = await groupsTable()
    .select('*')
    .eq('user', userId)
    .order('created_at', { ascending: true });
  return { data, error };
};

export const createGroup = async (name: string, userId: string) => {
  const { data, error } = await groupsTable()
    .insert({
      name,
      user: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
};

export const updateGroup = async (groupId: string, updates: any) => {
  const { data, error } = await groupsTable()
    .update(updates)
    .eq('id', groupId)
    .select()
    .single();
  return { data, error };
};

export const deleteGroup = async (groupId: string) => {
  // First, move all garden plants from this group to null (ungrouped)
  await gardenTable()
    .update({ group: null })
    .eq('group', groupId);

  const { error } = await groupsTable()
    .delete()
    .eq('id', groupId);
  return { error };
};

/** Get plants in a group. Tries group.plant_id first, then garden.group. */
export const getGroupPlants = async (groupId: string, userId?: string) => {
  const { data: group, error: groupError } = await groupsTable()
    .select('*')
    .eq('id', groupId)
    .single();
  if (groupError || !group) {
    return { data: null, error: groupError };
  }
  const plantIds = group.plant_id;
  if (plantIds && Array.isArray(plantIds) && plantIds.length > 0) {
    let q = gardenTable().select('*').in('id', plantIds).order('created_at', { ascending: false });
    if (userId) q = q.eq('user', userId);
    const { data, error } = await q;
    if (!error && data && data.length > 0) {
      const orderMap = new Map(plantIds.map((id, i) => [Number(id), i]));
      data.sort((a: any, b: any) => (orderMap.get(Number(b.id)) ?? -1) - (orderMap.get(Number(a.id)) ?? -1));
      return { data, error };
    }
  }
  let q = gardenTable().select('*').eq('group', groupId).order('created_at', { ascending: false });
  if (userId) q = q.eq('user', userId);
  return await q;
};

export const addPlantToGroup = async (groupId: string, plantId: string | number, currentPlantIds: (string | number)[]) => {
  const updatedIds = [...(currentPlantIds || []), plantId];
  const { data, error } = await groupsTable()
    .update({ plant_id: updatedIds })
    .eq('id', groupId)
    .select()
    .single();
  return { data, error };
};

export const removePlantFromGroup = async (groupId: string, plantId: string | number, currentPlantIds: (string | number)[]) => {
  const pid = typeof plantId === 'string' ? plantId : String(plantId);
  const updatedIds = (currentPlantIds || []).filter((id) => String(id) !== pid);
  const { data, error } = await groupsTable()
    .update({ plant_id: updatedIds })
    .eq('id', groupId)
    .select()
    .single();
  return { data, error };
};

// Snaps functions
export const createSnap = async (snapData: any) => {
  const { data, error } = await snapsTable()
    .insert(snapData)
    .select()
    .single();
  return { data, error };
};

export const getSnaps = async (userId: string) => {
  const { data, error } = await snapsTable()
    .select('*')
    .eq('user', userId)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const deleteSnap = async (snapId: string) => {
  const { error } = await snapsTable()
    .delete()
    .eq('id', snapId);
  return { error };
};

export const findGardenPlantByName = async (userId: string, plantName: string) => {
  const { data, error } = await gardenTable()
    .select('*')
    .eq('user', userId)
    .eq('name', plantName)
    .limit(1);
  return { data: data && data.length > 0 ? data[0] : null, error };
};

// AI Chat functions
export const getAIChat = async (userId: string) => {
  const { data, error } = await aiTable()
    .select('*')
    .eq('user', userId)
    .single();
  return { data, error };
};

export const createAIChat = async (userId: string) => {
  const { data, error } = await aiTable()
    .insert({
      user: userId,
      messages: [],
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
};

export const updateAIChat = async (chatId: string, messages: any[]) => {
  const { data, error } = await aiTable()
    .update({ messages })
    .eq('id', chatId)
    .select()
    .single();
  return { data, error };
};

export const deleteAIChat = async (userId: string) => {
  const { error } = await aiTable()
    .delete()
    .eq('user', userId);
  return { error };
};

export const clearAIChat = async (userId: string) => {
  const { data, error } = await aiTable()
    .update({ messages: [] })
    .eq('user', userId)
    .select()
    .single();
  return { data, error };
};

// Articles functions — faqat draft bo‘lmagan maqolalar (home page uchun)
export const getArticles = async () => {
  const { data, error } = await articleTable()
    .select('*')
    .neq('status', 'draft')
    .order('created_at', { ascending: false });
  return { data, error };
};

export const getArticle = async (articleId: string) => {
  const { data, error } = await articleTable()
    .select('*')
    .eq('id', articleId)
    .single();
  return { data, error };
};

// Storage helper for uploading images
export const uploadImage = async (bucket: string, path: string, file: Blob) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file);
  return { data, error };
};

export const getPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};
