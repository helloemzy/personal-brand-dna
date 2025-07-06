import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'login':
        return handleGoogleLogin(req, res);
      case 'callback':
        return handleGoogleCallback(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGoogleLogin(req, res) {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;

    return res.status(200).json({ url: data.url });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(400).json({ error: error.message });
  }
}

async function handleGoogleCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) throw error;

    // Create or update user profile
    const { user } = data;
    if (user) {
      // Check if user exists in our users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!existingUser) {
        // Create new user
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata.full_name?.split(' ')[0] || '',
            last_name: user.user_metadata.full_name?.split(' ').slice(1).join(' ') || '',
            email_verified: true,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating user:', insertError);
        }
      }
    }

    // Return success with session
    return res.status(200).json({
      success: true,
      session: data.session,
      user: data.user,
    });
  } catch (error) {
    console.error('Google callback error:', error);
    return res.status(400).json({ error: error.message });
  }
}