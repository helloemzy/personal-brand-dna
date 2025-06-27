import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Simple Login Page
function LoginPage() {
  const [formData, setFormData] = React.useState({
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Login successful! Redirecting...');
        localStorage.setItem('token', data.accessToken);
        // In a real app, you'd redirect to the dashboard
        setTimeout(() => {
          setMessage('Welcome! Dashboard coming soon...');
        }, 1000);
      } else {
        setMessage(data.message || 'Login failed');
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
          Sign In
        </h1>
        
        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
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
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
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
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: message.includes('successful') ? '#d1fae5' : '#fee2e2',
            color: message.includes('successful') ? '#065f46' : '#dc2626',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}
        
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/register" style={{ color: '#667eea' }}>Sign up</Link>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/" style={{ color: '#667eea', fontSize: '0.9rem' }}>← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}

// Simple Register Page
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
          Get Started
        </h1>
        
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
          Already have an account? <Link to="/login" style={{ color: '#667eea' }}>Sign in</Link>
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/" style={{ color: '#667eea', fontSize: '0.9rem' }}>← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}

// Landing Page
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
            <li>✅ Database Connected (Supabase)</li>
            <li>✅ Redis Cache Active (Upstash)</li>
            <li>✅ AI Content Generation Ready</li>
            <li>✅ User Authentication System</li>
          </ul>
        </div>

        <div style={{
          background: '#eff6ff',
          border: '1px solid #dbeafe',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>🎯 Ready for Beta Testing</h3>
          <p style={{ margin: 0, color: '#3730a3', fontSize: '0.9rem' }}>
            Your Personal Brand DNA system is fully deployed with working navigation!
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link 
            to="/register" 
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
            Get Started
          </Link>
          <Link 
            to="/login" 
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
            Sign In
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
            <strong>Next Steps:</strong> Add your voice → Generate content → Grow your brand
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;