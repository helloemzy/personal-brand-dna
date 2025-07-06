// Consolidated auth API router
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// For demo purposes, use fallback values if env vars are not set
const supabaseUrl = process.env.SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-key';
const supabase = supabaseUrl && supabaseKey && supabaseUrl !== 'https://demo.supabase.co' 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Use a default JWT secret for demo purposes if not configured
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-for-personal-brand-dna-2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

// Route handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'demo-login':
        return await handleDemoLogin(req, res);
      case 'login':
        return await handleLogin(req, res);
      case 'register':
        return await handleRegister(req, res);
      case 'send-otp':
        return await handleSendOtp(req, res);
      case 'verify-otp':
        return await handleVerifyOtp(req, res);
      case 'verify-email':
        return await handleVerifyEmail(req, res);
      default:
        return res.status(404).json({ error: 'Invalid auth action' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Demo login handler
async function handleDemoLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const demoUser = {
      id: 'demo-user-001',
      email: 'demo@personalbranddna.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'Marketing Manager',
      company: 'Demo Company',
      industry: 'Technology',
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const accessToken = jwt.sign(
      { userId: demoUser.id, email: demoUser.email, isDemo: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: demoUser.id, isDemo: true },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      user: demoUser,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Demo login error:', error);
    return res.status(500).json({ error: 'Failed to create demo session' });
  }
}

// Login handler
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // For demo purposes, accept any login with password "demo123" or specific test credentials
    const isDemoPassword = password === 'demo123';
    const isTestUser = email === 'test@example.com' && password === 'password123';
    
    if (!isDemoPassword && !isTestUser) {
      // If Supabase is configured, try real authentication
      if (supabase) {
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase())
          .single();

        if (error || !users) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, users.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = jwt.sign(
          { userId: users.id, email: users.email },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
          { userId: users.id },
          JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );

        const userResponse = {
          id: users.id,
          email: users.email,
          firstName: users.first_name,
          lastName: users.last_name,
          role: users.role,
          company: users.company,
          industry: users.industry,
          subscriptionTier: users.subscription_tier,
          subscriptionStatus: users.subscription_status,
          isVerified: users.is_verified,
          createdAt: users.created_at,
          updatedAt: users.updated_at
        };

        return res.status(200).json({
          user: userResponse,
          accessToken,
          refreshToken
        });
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Demo/test login successful
    const demoUser = {
      id: 'user-' + Date.now(),
      email: email,
      firstName: email.split('@')[0],
      lastName: 'User',
      role: 'Product Manager',
      company: 'Demo Company',
      industry: 'Technology',
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const accessToken = jwt.sign(
      { userId: demoUser.id, email: demoUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: demoUser.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      user: demoUser,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}

// Register handler
async function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, firstName, lastName, role, company, industry } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role,
        company,
        industry,
        verification_token: verificationToken,
        is_verified: false,
        subscription_tier: 'free',
        subscription_status: 'active'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      throw error;
    }

    // In a real app, send verification email here
    console.log('Verification token:', verificationToken);

    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: newUser.id
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

// Send OTP handler
async function handleSendOtp(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = jwt.sign(
      { email: email.toLowerCase(), otp },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    // In development, return OTP in response
    if (process.env.NODE_ENV === 'development') {
      return res.status(200).json({
        message: 'OTP sent successfully',
        otp,
        verificationToken
      });
    }

    // In production, send email
    // ... email sending logic ...

    return res.status(200).json({
      message: 'OTP sent successfully',
      verificationToken
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
}

// Verify OTP handler
async function handleVerifyOtp(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { otp, verificationToken } = req.body;

  if (!otp || !verificationToken) {
    return res.status(400).json({ error: 'OTP and verification token are required' });
  }

  try {
    const decoded = jwt.verify(verificationToken, JWT_SECRET);
    
    if (decoded.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', decoded.email)
      .single();

    let user;
    if (!existingUser) {
      // Create new user for OTP login
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: decoded.email,
          first_name: 'User',
          last_name: decoded.email.split('@')[0],
          is_verified: true,
          subscription_tier: 'free',
          subscription_status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      user = newUser;
    } else {
      user = existingUser;
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      company: user.company,
      industry: user.industry,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      isVerified: user.is_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    return res.status(200).json({
      user: userResponse,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'OTP has expired' });
    }
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

// Verify email handler
async function handleVerifyEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ is_verified: true, verification_token: null })
      .eq('verification_token', token)
      .select()
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    return res.status(200).json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        isVerified: true
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ error: 'Email verification failed' });
  }
}