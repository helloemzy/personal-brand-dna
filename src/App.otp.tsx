import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// OTP Login Page
function OTPLoginPage() {
  const [step, setStep] = React.useState<'email' | 'otp'>('email');
  const [formData, setFormData] = React.useState({
    email: '',
    otp: '',
    firstName: '',
    lastName: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [debugOtp, setDebugOtp] = React.useState('');
  const [verificationToken, setVerificationToken] = React.useState('');

  const sendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('OTP sent to your email!');
        setDebugOtp(data.debug?.otp || '');
        setVerificationToken(data.verificationToken || '');
        setStep('otp');
      } else {
        setMessage(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          verificationToken: verificationToken
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Login successful! Welcome to Personal Brand DNA!');
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        setMessage(data.message || 'Verification failed');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          {step === 'email' ? 'Sign In with Email' : 'Enter OTP'}
        </h1>
        
        {step === 'email' ? (
          <form onSubmit={sendOTP} style={{ marginBottom: '2rem' }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="First Name (optional)"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                style={{
                  width: '50%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
              <input
                type="text"
                placeholder="Last Name (optional)"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                style={{
                  width: '50%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#9ca3af' : '#667eea',
                color: 'white',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP} style={{ marginBottom: '2rem' }}>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
              We sent a 6-digit code to {formData.email}
            </p>
            {debugOtp && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #dbeafe',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}>
                <strong>Demo Mode:</strong> Your OTP is <strong>{debugOtp}</strong>
                <br />
                <em>(In production, this would be sent via email)</em>
              </div>
            )}
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={formData.otp}
              onChange={(e) => setFormData({...formData, otp: e.target.value})}
              required
              maxLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                textAlign: 'center',
                letterSpacing: '0.5rem'
              }}
            />
            <button
              type="submit"
              disabled={loading || formData.otp.length !== 6}
              style={{
                width: '100%',
                background: (loading || formData.otp.length !== 6) ? '#9ca3af' : '#667eea',
                color: 'white',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: (loading || formData.otp.length !== 6) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              style={{
                width: '100%',
                background: 'transparent',
                color: '#667eea',
                padding: '0.5rem',
                marginTop: '0.5rem',
                border: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              ← Change Email
            </button>
          </form>
        )}
        
        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: message.includes('successful') || message.includes('sent') ? '#d1fae5' : '#fee2e2',
            color: message.includes('successful') || message.includes('sent') ? '#065f46' : '#dc2626',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}
        
        <p style={{ marginTop: '1rem' }}>
          <Link to="/" style={{ color: '#667eea', fontSize: '0.9rem' }}>← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}

// Landing Page (updated with OTP option)
function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🚀 Personal Brand DNA
        </h1>
        
        <p style={{
          fontSize: '1.25rem',
          color: '#6b7280',
          marginBottom: '2rem'
        }}>
          Your AI-powered professional voice discovery system is now live!
        </p>

        <div style={{
          background: '#f3f4f6',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#374151' }}>✅ What's Working</h2>
          <ul style={{ 
            textAlign: 'left', 
            margin: 0, 
            paddingLeft: '1.5rem',
            color: '#6b7280'
          }}>
            <li>✅ React Frontend Deployed</li>
            <li>✅ API Backend Running</li>
            <li>✅ OTP Email Authentication</li>
            <li>✅ AI Content Generation Ready</li>
            <li>✅ Redis Cache Active (Upstash)</li>
            <li>✅ Secure Passwordless Login</li>
          </ul>
        </div>

        <div style={{
          background: '#eff6ff',
          border: '1px solid #dbeafe',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>🎯 Passwordless Authentication</h3>
          <p style={{ margin: 0, color: '#3730a3', fontSize: '0.9rem' }}>
            Sign in securely with just your email - no passwords required!
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link 
            to="/otp-login" 
            style={{
              background: '#667eea',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            🔐 Sign In with Email
          </Link>
          <Link 
            to="/register" 
            style={{
              background: 'transparent',
              color: '#667eea',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: '600',
              border: '2px solid #667eea',
              transition: 'all 0.2s'
            }}
          >
            Traditional Sign Up
          </Link>
        </div>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
          fontSize: '0.875rem',
          color: '#9ca3af'
        }}>
          <p style={{ margin: 0 }}>
            <strong>Try OTP Login:</strong> Enter email → Get code → Access your brand DNA
          </p>
        </div>
      </div>
    </div>
  );
}

// Simple Register Page (keeping original for fallback)
function RegisterPage() {
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Account created successfully! Please check your email to verify your account.');
        setFormData({ firstName: '', lastName: '', email: '', password: '' });
      } else {
        setMessage(data.message || 'Registration failed');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Traditional Sign Up
        </h1>
        
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          fontSize: '0.9rem'
        }}>
          ⚠️ <strong>Note:</strong> Having database issues. Try <Link to="/otp-login" style={{ color: '#1e40af' }}>OTP Login</Link> instead!
        </div>
        
        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              required
              style={{
                width: '50%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              required
              style={{
                width: '50%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          />
          <input
            type="password"
            placeholder="Password (8+ chars, A-z, 0-9, special)"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
            minLength={8}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          />
          <p style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            margin: '0 0 1rem 0',
            textAlign: 'left'
          }}>
            Password must contain uppercase, lowercase, number, and special character
          </p>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#9ca3af' : '#667eea',
              color: 'white',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: message.includes('successfully') ? '#d1fae5' : '#fee2e2',
            color: message.includes('successfully') ? '#065f46' : '#dc2626',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}
        
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          Try passwordless? <Link to="/otp-login" style={{ color: '#667eea' }}>OTP Login</Link>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/" style={{ color: '#667eea', fontSize: '0.9rem' }}>← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/otp-login" element={<OTPLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;