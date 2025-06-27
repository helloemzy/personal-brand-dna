import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Instant Demo Login
function InstantLoginPage() {
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  const instantLogin = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('🎉 Welcome to Personal Brand DNA! You\'re now logged in.');
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setIsLoggedIn(true);
      } else {
        setMessage(data.message || 'Demo login failed');
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
        maxWidth: '500px',
        width: '100%'
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
          AI-powered professional voice discovery & content generation
        </p>

        {!isLoggedIn ? (
          <>
            <div style={{
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              marginBottom: '2rem'
            }}>
              <h2 style={{ margin: '0 0 1rem 0', color: '#1e40af' }}>✨ Instant Demo Access</h2>
              <p style={{ margin: '0 0 1rem 0', color: '#3730a3', fontSize: '1rem' }}>
                Skip all the signup hassle - try the full system immediately!
              </p>
              <ul style={{ 
                textAlign: 'left', 
                margin: 0, 
                paddingLeft: '1.5rem',
                color: '#3730a3',
                fontSize: '0.9rem'
              }}>
                <li>✅ No passwords or email verification</li>
                <li>✅ Full access to AI content generation</li>
                <li>✅ Voice analysis and brand discovery</li>
                <li>✅ Professional-tier features unlocked</li>
              </ul>
            </div>

            <button
              onClick={instantLogin}
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '0.75rem',
                border: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '1rem',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? '🔄 Logging you in...' : '🎯 Try Demo - Instant Access!'}
            </button>
          </>
        ) : (
          <div style={{
            background: '#d1fae5',
            border: '1px solid #10b981',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            marginBottom: '2rem'
          }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#065f46' }}>🎉 You're In!</h2>
            <p style={{ margin: '0 0 1rem 0', color: '#065f46', fontSize: '1rem' }}>
              Welcome to Personal Brand DNA! Your demo account is ready.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '1.5rem'
            }}>
              <button
                style={{
                  background: '#10b981',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🎯 Start Voice Discovery
              </button>
              <button
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ✍️ Generate Content
              </button>
            </div>
          </div>
        )}

        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: message.includes('Welcome') ? '#d1fae5' : '#fee2e2',
            color: message.includes('Welcome') ? '#065f46' : '#dc2626',
            fontSize: '1rem',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginTop: '2rem',
          fontSize: '0.9rem'
        }}>
          <Link to="/otp-login" style={{ color: '#667eea' }}>OTP Login</Link>
          <span style={{ color: '#d1d5db' }}>|</span>
          <Link to="/register" style={{ color: '#667eea' }}>Traditional Signup</Link>
        </div>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
          fontSize: '0.875rem',
          color: '#9ca3af'
        }}>
          <p style={{ margin: 0 }}>
            <strong>Demo Features:</strong> Voice analysis • Content generation • Brand discovery
          </p>
        </div>
      </div>
    </div>
  );
}

// Simple Landing Page
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
          Your AI-powered professional voice discovery system
        </p>

        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#92400e' }}>⚡ Skip the Hassle!</h2>
          <p style={{ margin: 0, color: '#92400e', fontSize: '1rem' }}>
            No passwords, no email verification, no waiting. 
            <br />
            <strong>Get instant access to the full system!</strong>
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link 
            to="/instant-demo" 
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '1rem 2rem',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '1.1rem',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s ease'
            }}
          >
            🎯 Try Instant Demo
          </Link>
          <Link 
            to="/otp-login" 
            style={{
              background: 'transparent',
              color: '#667eea',
              padding: '1rem 2rem',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              fontWeight: '600',
              border: '2px solid #667eea',
              transition: 'all 0.2s'
            }}
          >
            🔐 OTP Login
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
            <strong>Instant Demo:</strong> One click → Full access → Start creating
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/instant-demo" element={<InstantLoginPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;