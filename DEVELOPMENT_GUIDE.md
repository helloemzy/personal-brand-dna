# Personal Brand DNA - Development Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Vercel CLI (`npm install -g vercel`)
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/helloemzy/personal-brand-dna.git
   cd personal-brand-dna/Documents/pbdna
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run local development server**
   ```bash
   # Using Vercel CLI (recommended for serverless functions)
   vercel dev
   
   # Or traditional React development
   npm start
   ```

## 🏗️ Project Structure

```
pbdna/
├── api/                    # Vercel serverless functions
│   ├── auth/              # Authentication endpoints
│   ├── content/           # Content generation endpoints
│   └── _lib/              # Shared utilities
├── src/                    # React frontend
│   ├── components/        # Reusable components
│   ├── pages/            # Page components
│   ├── store/            # Redux store
│   ├── services/         # API services
│   └── types/            # TypeScript types
├── backend/               # Legacy backend (for reference)
├── public/               # Static assets
└── build/                # Production build

```

## 🔧 Development Workflow

### Running Serverless Functions Locally

```bash
# Start Vercel development server
vercel dev

# API endpoints available at:
# http://localhost:3000/api/*
```

### Frontend Development

```bash
# Start React development server
npm start

# Run tests
npm test

# Build for production
npm run build
```

### Testing API Endpoints

```bash
# Test health check
curl http://localhost:3000/api/hello

# Test demo login
curl -X POST http://localhost:3000/api/auth/demo-login

# Test with authentication
TOKEN=$(curl -X POST http://localhost:3000/api/auth/demo-login | jq -r '.accessToken')
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/content/generate
```

## 📝 Code Style Guidelines

### TypeScript
- Strict mode enabled
- No `any` types
- Explicit return types for functions
- Interface over type aliases for objects

### React Components
- Functional components with hooks
- Props interfaces defined
- Error boundaries for critical sections
- Memoization for expensive computations

### API Endpoints
- ES modules (export default)
- Consistent error handling
- Input validation
- CORS headers included

## 🧪 Testing

### Unit Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
# Run Vercel in test mode
vercel dev --listen 3001

# Run integration tests
npm run test:integration
```

### E2E Tests
```bash
# Start application
vercel dev

# Run Cypress tests
npm run cypress:open
```

## 🚀 Deployment

### Development Deployment
```bash
# Deploy to Vercel preview
vercel

# Follow prompts to link project
```

### Production Deployment
```bash
# Deploy to production
vercel --prod
```

### Environment Variables
Required environment variables for production:
- `OPENAI_API_KEY` - OpenAI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `REDIS_URL` - Upstash Redis URL
- `JWT_SECRET` - Secret for JWT tokens

## 🐛 Debugging

### Vercel Functions
```bash
# Enable debug logs
DEBUG=* vercel dev

# Check function logs
vercel logs
```

### React DevTools
- Install React Developer Tools extension
- Use Redux DevTools for state debugging

### Common Issues

1. **Function timeout**
   - Check API response times
   - Optimize database queries
   - Implement caching

2. **CORS errors**
   - Verify API endpoint headers
   - Check allowed origins

3. **Authentication failures**
   - Verify JWT token format
   - Check token expiration

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Project GitHub](https://github.com/helloemzy/personal-brand-dna)

## 🤝 Contributing

1. Create feature branch
2. Make changes with tests
3. Run linting and tests
4. Submit pull request

### Commit Convention
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Code style changes
refactor: Code refactoring
test: Add tests
chore: Build/tool changes
```

---
Last updated: June 26, 2025