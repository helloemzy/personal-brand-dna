import { supabase } from '../services/supabaseClient';
import { User } from '../store/slices/authSlice';

export const mapSupabaseUserToAppUser = (supabaseUser: any): User => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    firstName: supabaseUser.user_metadata?.full_name?.split(' ')[0] || 
               supabaseUser.user_metadata?.name?.split(' ')[0] || 
               supabaseUser.user_metadata?.given_name || 
               '',
    lastName: supabaseUser.user_metadata?.full_name?.split(' ')[1] || 
              supabaseUser.user_metadata?.name?.split(' ')[1] || 
              supabaseUser.user_metadata?.family_name || 
              '',
    subscriptionTier: 'free',
    subscriptionStatus: 'active',
    isVerified: supabaseUser.email_confirmed_at ? true : false,
    createdAt: supabaseUser.created_at,
    updatedAt: supabaseUser.updated_at || supabaseUser.created_at,
  };
};

export const checkSupabaseAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }
    
    return {
      user: mapSupabaseUserToAppUser(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token || null,
    };
  } catch (error) {
    throw error;
  }
};

export const signOutSupabase = async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Supabase signout error:', error);
    // Continue with local signout even if Supabase fails
  }
};