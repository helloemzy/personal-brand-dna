import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Twilio client for SMS
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// JWT secrets
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Main handler
export default async function handler(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Route to appropriate handler
    if (pathname.endsWith('/send-otp')) {
      return await handleSendOTP(req, res);
    } else if (pathname.endsWith('/verify-otp')) {
      return await handleVerifyOTP(req, res);
    } else if (pathname.endsWith('/check-status')) {
      return await handleCheckStatus(req, res);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('Phone auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Send OTP to phone number
async function handleSendOTP(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Format phone number - extract country code if included
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;
  
  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, phone_number')
      .eq('phone_number', formattedPhone)
      .single();

    // Create or update user
    let userId;
    if (existingUser) {
      userId = existingUser.id;
      // Update OTP
      await supabase
        .from('users')
        .update({
          phone_verification_code: otpCode,
          phone_verification_expires: expiresAt.toISOString()
        })
        .eq('id', userId);
    } else {
      // Don't create user yet - wait for verification with user data
      // Just store the OTP temporarily
      userId = null;
    }

    // Log OTP attempt
    await supabase
      .from('phone_otp_logs')
      .insert({
        phone_number: formattedPhone,
        otp_code: otpCode,
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        expires_at: expiresAt.toISOString(),
        user_id: userId // Can be null for new users
      });

    // Send SMS via Twilio
    if (process.env.NODE_ENV === 'production') {
      await twilioClient.messages.create({
        body: `Your Personal Brand DNA verification code is: ${otpCode}. It expires in 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone
      });
    }

    // Create a verification token for the frontend
    const verificationToken = jwt.sign(
      { 
        phoneNumber: formattedPhone,
        otpCode: otpCode,
        expiresAt: expiresAt.toISOString()
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    // In development, return OTP in response
    const response = {
      message: 'OTP sent successfully',
      expiresAt: expiresAt.toISOString(),
      verificationToken
    };

    if (process.env.NODE_ENV === 'development') {
      response.otpCode = otpCode; // Only in dev for testing
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
}

// Verify OTP and create session
async function handleVerifyOTP(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phoneNumber, otpCode, verificationToken, userData } = req.body;

  if (!phoneNumber || !otpCode || !verificationToken) {
    return res.status(400).json({ error: 'Phone number, OTP code, and verification token are required' });
  }

  // Verify the token first
  let tokenData;
  try {
    tokenData = jwt.verify(verificationToken, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid verification token' });
  }

  // Check if token matches the phone number and OTP
  if (tokenData.phoneNumber !== phoneNumber || tokenData.otpCode !== otpCode) {
    return res.status(401).json({ error: 'Invalid verification data' });
  }

  const formattedPhone = phoneNumber;

  try {
    // Check if user exists
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', formattedPhone)
      .maybeSingle();

    // If user doesn't exist and we have userData, create new user
    if (!user && userData) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          phone_number: formattedPhone,
          phone_verified: true,
          first_name: userData.name?.split(' ')[0] || '',
          last_name: userData.name?.split(' ').slice(1).join(' ') || '',
          occupation: userData.occupation,
          country: userData.country,
          subscription_tier: 'free',
          subscription_status: 'active',
          voice_discovery_status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Create user error:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      user = newUser;
    } else if (!user) {
      return res.status(404).json({ error: 'User not found. Please complete registration first.' });
    }

    // Verify OTP from token (already verified above)
    const now = new Date();
    const expires = new Date(tokenData.expiresAt);

    if (now > expires) {
      await supabase
        .from('phone_otp_logs')
        .update({ status: 'expired' })
        .eq('phone_number', formattedPhone)
        .eq('otp_code', otpCode);

      return res.status(401).json({ error: 'OTP code has expired' });
    }

    // Mark phone as verified
    await supabase
      .from('users')
      .update({
        phone_verified: true,
        phone_verification_code: null,
        phone_verification_expires: null
      })
      .eq('id', user.id);

    // Update OTP log
    await supabase
      .from('phone_otp_logs')
      .update({ 
        status: 'verified',
        verified_at: now.toISOString()
      })
      .eq('phone_number', formattedPhone)
      .eq('otp_code', otpCode);

    // Create JWT tokens
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        phoneNumber: user.phone_number,
        voiceDiscoveryStatus: user.voice_discovery_status 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Create user profile if it doesn't exist
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        last_login: now.toISOString()
      }, {
        onConflict: 'user_id'
      });

    // Return user data
    const userData = {
      id: user.id,
      phoneNumber: user.phone_number,
      countryCode: user.country_code,
      phoneVerified: user.phone_verified,
      voiceDiscoveryStatus: user.voice_discovery_status,
      voiceDiscoveryCompletedAt: user.voice_discovery_completed_at,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      createdAt: user.created_at
    };

    return res.status(200).json({
      user: userData,
      accessToken,
      refreshToken,
      requiresVoiceDiscovery: user.voice_discovery_status === 'pending'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

// Check user status and voice discovery progress
async function handleCheckStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        personal_brand_frameworks (
          id,
          brand_archetype,
          value_proposition,
          confidence_score,
          created_at
        ),
        voice_calls (
          id,
          call_status,
          call_duration_seconds,
          created_at
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get latest voice call
    const latestVoiceCall = user.voice_calls?.[0];
    const latestFramework = user.personal_brand_frameworks?.[0];

    return res.status(200).json({
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        voiceDiscoveryStatus: user.voice_discovery_status,
        voiceDiscoveryCompletedAt: user.voice_discovery_completed_at
      },
      voiceCall: latestVoiceCall ? {
        id: latestVoiceCall.id,
        status: latestVoiceCall.call_status,
        duration: latestVoiceCall.call_duration_seconds,
        createdAt: latestVoiceCall.created_at
      } : null,
      brandFramework: latestFramework ? {
        id: latestFramework.id,
        archetype: latestFramework.brand_archetype,
        valueProposition: latestFramework.value_proposition,
        confidenceScore: latestFramework.confidence_score,
        createdAt: latestFramework.created_at
      } : null
    });
  } catch (error) {
    console.error('Check status error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to check status' });
  }
}

// Helper function to format phone number
function formatPhoneNumber(phoneNumber, countryCode = '+1') {
  // Remove all non-numeric characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If number already includes country code
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Add country code
  return `${countryCode}${cleaned}`;
}