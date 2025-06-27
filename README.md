# Personal Brand DNA + BrandHack 🚀

> The world's first AI system that discovers, analyzes, and replicates your authentic professional voice to generate high-impact personal brand content that drives real business outcomes.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## 🎯 Overview

Personal Brand DNA solves the #1 challenge professionals face on LinkedIn: "What should I post?" Through a revolutionary 5-minute voice analysis, we create your unique voice signature and generate authentic content that sounds genuinely like you while driving career advancement.

### ✨ Key Features

- **🎤 Voice Discovery Engine**: 5-minute conversational analysis to map your authentic communication style
- **🤖 AI Content Generation**: GPT-4 powered content that matches your unique voice
- **📊 BrandHack Workshop**: Comprehensive 5-step brand strategy development
- **📰 Smart News Curation**: AI-powered relevance scoring for industry insights
- **📅 Content Calendar**: Visual scheduling with drag-and-drop management
- **🔗 LinkedIn Integration**: Safe automation with manual approval workflow
- **📈 Analytics Dashboard**: Track performance and optimize strategy

## 🚀 Quick Start

### Try the Demo

Experience Personal Brand DNA instantly:

1. Visit [our live demo](https://personal-brand-9xbs1h6da-helloemilywho-gmailcoms-projects.vercel.app)
2. Click "🎯 Try Instant Demo"
3. Explore all Professional-tier features immediately

### Local Development

```bash
# Clone the repository
git clone https://github.com/helloemzy/personal-brand-dna.git
cd personal-brand-dna

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development environment
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# AI Pipeline: http://localhost:8000
```

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Redux Toolkit
- **Backend**: Node.js + Express + Serverless Functions
- **Database**: PostgreSQL (Supabase) + Redis (Upstash)
- **AI/ML**: OpenAI GPT-4 + Custom NLP Pipeline
- **Infrastructure**: Vercel Serverless + Docker
- **Authentication**: JWT + Multiple Auth Methods
- **Payments**: Stripe Subscriptions

### Project Structure

```
personal-brand-dna/
├── src/                    # React frontend application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Route-based pages
│   ├── store/             # Redux state management
│   └── services/          # API integration
├── api/                   # Serverless API endpoints
│   ├── auth/              # Authentication endpoints
│   ├── workshop/          # Brand workshop APIs
│   ├── content/           # Content generation
│   ├── linkedin/          # LinkedIn integration
│   └── _lib/              # Shared utilities
├── backend/               # Legacy backend (reference)
├── docs/                  # Documentation
└── monitoring/            # Monitoring configuration
```

## 🎯 Core Features

### 1. Voice Discovery Engine

Our proprietary 5-minute voice analysis captures your authentic professional communication style:

- Speech-to-text transcription
- Multi-dimensional voice analysis
- Personality mapping
- Communication pattern recognition

### 2. Content Generation

AI-powered content creation that sounds genuinely like you:

- 50+ proven LinkedIn templates
- Voice-aware adaptation
- Industry trend integration
- Multiple content formats

### 3. BrandHack Features

#### 🎨 Brand Workshop
- Values audit with 30+ professional values
- Tone preference calibration
- Target audience persona builder
- Writing sample analysis
- Personality assessment quiz

#### 📰 News Integration "Newshack"
- RSS/JSON feed aggregation
- AI relevance scoring
- Personalized news dashboard
- Content idea generation

#### 📅 Content Calendar
- Drag-and-drop scheduling
- Multi-view options (month/week/day)
- Content series management
- Platform-specific timing

#### 🔗 LinkedIn Automation
- Secure OAuth integration
- Manual approval workflow
- Comprehensive safety checks
- Analytics and insights

## 🔧 Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Authentication
JWT_SECRET=...
ENCRYPTION_KEY=...

# AI Services
OPENAI_API_KEY=sk-proj-...
GOOGLE_APPLICATION_CREDENTIALS=...

# External Services (Optional)
STRIPE_SECRET_KEY=sk_test_...
LINKEDIN_CLIENT_ID=...
SENDGRID_API_KEY=SG....
SENTRY_DSN=https://...
```

### External Service Setup

1. **OpenAI**: Get API key from [platform.openai.com](https://platform.openai.com)
2. **Google Cloud**: Enable Speech-to-Text API
3. **Supabase**: Create project for database
4. **Upstash**: Set up Redis instance
5. **LinkedIn**: Create OAuth application

## 📊 API Reference

### Authentication
```http
POST /api/auth/demo-login      # Instant demo access
POST /api/auth/register        # User registration
POST /api/auth/login          # User login
POST /api/auth/send-otp       # Send OTP code
POST /api/auth/verify-otp     # Verify OTP
```

### Workshop
```http
POST /api/workshop/start                          # Start session
GET  /api/workshop/session/{id}                   # Get progress
POST /api/workshop/session/{id}/save              # Save progress
POST /api/workshop/session/{id}/complete          # Complete workshop
```

### Content
```http
POST /api/content/generate     # Generate content
GET  /api/content/history      # View history
GET  /api/content/templates    # List templates
```

### LinkedIn
```http
GET  /api/linkedin/auth        # Start OAuth
POST /api/linkedin/queue       # Queue content
GET  /api/linkedin/analytics   # View metrics
```

## 🚀 Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/helloemzy/personal-brand-dna)

### Manual Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
vercel env add OPENAI_API_KEY production
# ... add other variables
```

## 📈 Business Model

### Pricing Tiers

- **Free**: Voice discovery + 3 posts/month
- **Professional** ($49/month): Unlimited content + analytics
- **Executive** ($149/month): + Speaking prep + team features
- **Enterprise** (Custom): + Brand compliance + API access

### Target Market

- Primary: Ambitious professionals (Manager-Director level)
- Secondary: Established experts (Senior Director-VP)
- Tertiary: Independent consultants and coaches

## 🔒 Security

- **Data Encryption**: AES-256 for all sensitive data
- **Authentication**: JWT with refresh tokens
- **API Security**: Rate limiting, input validation
- **Compliance**: GDPR, CCPA ready
- **Privacy**: User owns all generated content

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📊 Performance

- **API Response Time**: < 200ms average
- **Content Generation**: < 10 seconds
- **Voice Analysis**: < 30 seconds for 5-minute recording
- **Uptime Target**: 99.9%

## 🐛 Troubleshooting

### Common Issues

**Build Failures**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Database Connection**
- Verify DATABASE_URL format
- Check network connectivity
- Ensure SSL mode matches environment

**API Errors**
- Check API keys are valid
- Verify rate limits
- Review error logs in monitoring

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [BrandHack Features](docs/BRANDHACK_FEATURES.md)
- [API Documentation](api/API_DOCUMENTATION.md)
- [Monitoring Setup](docs/MONITORING_SETUP.md)

## 🎯 Roadmap

### Phase 2: Growth Features (Q3 2025)
- [ ] Mobile app (React Native)
- [ ] Browser extension
- [ ] Team collaboration
- [ ] Multi-language support

### Phase 3: Enterprise (Q4 2025)
- [ ] SSO integration
- [ ] Advanced analytics
- [ ] White-label options
- [ ] API marketplace

## 📞 Support

- **Documentation**: [docs.personalbranddna.com](https://docs.personalbranddna.com)
- **Email**: support@personalbranddna.com
- **Discord**: [Join our community](https://discord.gg/personalbrand)
- **Issues**: [GitHub Issues](https://github.com/helloemzy/personal-brand-dna/issues)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Google Cloud for Speech-to-Text
- Vercel for hosting infrastructure
- All our beta testers and early adopters

---

**Built with ❤️ by the Personal Brand DNA Team**

*Transform your professional voice into career opportunities*