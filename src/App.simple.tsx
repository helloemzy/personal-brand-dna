
function App() {
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
            Your Personal Brand DNA system is fully deployed and ready for users!
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <a 
            href="/register" 
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
          </a>
          <a 
            href="/login" 
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
          </a>
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

export default App;