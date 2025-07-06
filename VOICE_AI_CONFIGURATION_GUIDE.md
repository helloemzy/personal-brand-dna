# Voice AI Configuration Guide (Vapi.ai / Bland.ai)

## 🎯 Overview
The voice discovery system uses AI-powered phone calls to conduct natural 5-minute brand discovery conversations. You can use either Vapi.ai or Bland.ai as your voice AI provider.

## 🔄 Provider Comparison

### Vapi.ai (Recommended)
- **Pros**: Better voice quality, more natural conversations, robust webhook system
- **Pricing**: ~$0.05/minute for calls
- **Free Trial**: $10 credit (200 minutes)

### Bland.ai
- **Pros**: Simpler setup, good for basic conversations
- **Pricing**: ~$0.09/minute for calls
- **Free Trial**: 30 minutes

## 🚀 Vapi.ai Setup

### 1. Create Account
1. Go to [https://vapi.ai](https://vapi.ai)
2. Sign up with email
3. Verify your account

### 2. Get API Credentials
1. Navigate to Dashboard → API Keys
2. Create a new API key
3. Copy the key (format: `vapi_xxxxxxxxxxxxx`)

### 3. Configure Voice Assistant
In Vapi dashboard, create an assistant with these settings:

```json
{
  "name": "Personal Brand Discovery Assistant",
  "voice": {
    "provider": "11labs",
    "voiceId": "rachel",
    "stability": 0.8,
    "similarityBoost": 0.75
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7
  },
  "firstMessage": "Hi! I'm so excited to help you discover your personal brand. This is going to be a relaxed conversation about your professional journey. Ready to get started?",
  "maxDurationSeconds": 420,
  "endCallFunctionEnabled": true,
  "transcriptionProvider": "deepgram"
}
```

### 4. Environment Variables
Add to Vercel:
```bash
VOICE_AI_API_KEY=vapi_xxxxxxxxxxxxx
VOICE_AI_BASE_URL=https://api.vapi.ai
VOICE_AI_PROVIDER=vapi
```

## 🎭 Bland.ai Setup (Alternative)

### 1. Create Account
1. Go to [https://bland.ai](https://bland.ai)
2. Sign up and verify email

### 2. Get API Key
1. Go to Settings → API
2. Generate new API key
3. Copy the key

### 3. Environment Variables
```bash
VOICE_AI_API_KEY=bland_xxxxxxxxxxxxx
VOICE_AI_BASE_URL=https://api.bland.ai/v1
VOICE_AI_PROVIDER=bland
```

## 📋 Discovery Questions Configuration

The system uses 10 strategic questions based on expert frameworks:

### 1. StoryBrand Framework (Donald Miller)
- "What transformation do you help your clients achieve?"
- "What's the biggest problem you solve for people?"

### 2. Fascination Advantage (Sally Hogshead)
- "When do you feel most energized in your work?"
- "What do people consistently come to you for help with?"

### 3. Personal Brand Pyramid (Dorie Clark)
- "What's your unique approach or methodology?"
- "What expertise have you developed that others haven't?"

### 4. Jungian Archetypes
- "If you had to describe your professional role as a character, who would it be?"
- "What drives you to do the work you do?"

### 5. Authentic Voice Discovery
- "Tell me about a recent professional win that made you proud."
- "What's one belief you have about your industry that others might disagree with?"

## 🔊 Voice Configuration Best Practices

### Voice Selection
- **Female voices**: Rachel, Bella, Emily (warm, professional)
- **Male voices**: Josh, Arnold, Patrick (confident, authoritative)
- **Recommendation**: Rachel for most users (balanced warmth and professionalism)

### Voice Settings
```json
{
  "stability": 0.8,         // Consistent tone (0.5-1.0)
  "similarityBoost": 0.75,  // Natural variation (0.0-1.0)
  "speakingRate": 1.0,      // Normal speed (0.5-2.0)
  "pitch": 0                // Natural pitch (-20 to 20)
}
```

### Conversation Flow
1. **Opening** (30 seconds)
   - Warm greeting
   - Set expectations
   - Build rapport

2. **Discovery** (4-5 minutes)
   - Ask open-ended questions
   - Active listening responses
   - Natural follow-ups

3. **Closing** (30 seconds)
   - Summarize key points
   - Thank for sharing
   - Explain next steps

## 🪝 Webhook Configuration

### Webhook URL
```
https://your-app.vercel.app/api/voice-discovery/webhook
```

### Expected Events
1. `call.started` - Call initiated
2. `call.ended` - Call completed
3. `transcript.completed` - Full transcript ready
4. `recording.completed` - Audio file available

### Webhook Payload Example
```json
{
  "event": "call.ended",
  "callId": "call_123456",
  "duration": 324,
  "status": "completed",
  "recordingUrl": "https://storage.vapi.ai/recordings/call_123456.mp3",
  "transcript": {
    "text": "Full conversation text...",
    "segments": [
      {
        "speaker": "assistant",
        "text": "Hi! I'm so excited...",
        "timestamp": 0
      },
      {
        "speaker": "user",
        "text": "Hello, yes I'm ready...",
        "timestamp": 3.2
      }
    ]
  }
}
```

## 🧪 Testing Your Setup

### 1. Test Call Initiation
```bash
curl -X POST https://your-app.vercel.app/api/voice-discovery/initiate-call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Expected Response
```json
{
  "message": "Voice call initiated",
  "callId": "550e8400-e29b-41d4-a716-446655440000",
  "externalCallId": "call_vapi_123456",
  "estimatedDuration": "5-7 minutes"
}
```

### 3. Monitor Call Progress
- Check Vapi/Bland dashboard for live call status
- View real-time transcription
- Monitor webhook deliveries

## 💰 Cost Management

### Estimated Usage
- Average call duration: 5 minutes
- Cost per call: $0.25 (Vapi) or $0.45 (Bland)
- 100 users/day = $25-45/day

### Cost Optimization
1. Set max duration to 7 minutes
2. Use efficient prompts to keep conversations focused
3. Monitor for failed/abandoned calls
4. Consider bulk pricing at scale

## 🚨 Common Issues

### "Call not connecting"
- Verify phone number format (+1234567890)
- Check API key is valid
- Ensure webhooks are accessible

### "Poor voice quality"
- Try different voice models
- Adjust stability settings
- Check user's phone connection

### "Transcript not processing"
- Verify webhook URL is correct
- Check webhook logs in provider dashboard
- Ensure proper event handling

## 🔒 Security Considerations

1. **API Key Security**
   - Never expose in client-side code
   - Use environment variables only
   - Rotate keys regularly

2. **Recording Storage**
   - Download and store in your own storage
   - Delete from provider after processing
   - Implement retention policies

3. **User Consent**
   - Inform users calls are recorded
   - Get explicit consent
   - Provide opt-out options

## 📊 Analytics & Monitoring

### Key Metrics to Track
- Call completion rate (target: >80%)
- Average call duration (target: 5-7 min)
- Transcript quality score
- User satisfaction rating

### Monitoring Setup
```javascript
// Add to your analytics
track('voice_discovery_started', { userId, provider });
track('voice_discovery_completed', { userId, duration, quality });
track('voice_discovery_failed', { userId, reason });
```

## 🎯 Next Steps

1. Choose your provider (Vapi.ai recommended)
2. Create account and get API key
3. Add environment variables to Vercel
4. Test with a phone call
5. Monitor first 10 calls closely
6. Adjust voice settings based on feedback

Remember: The quality of the voice conversation directly impacts the entire user experience. Take time to test and optimize the voice settings for natural, engaging conversations.