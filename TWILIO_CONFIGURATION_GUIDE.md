# Twilio Configuration Guide for Phone Authentication

## 🚀 Quick Setup Steps

### 1. Create Twilio Account
1. Go to [https://www.twilio.com](https://www.twilio.com)
2. Sign up for a new account (or log in if you have one)
3. Complete phone verification
4. Get $15 free trial credit (enough for ~1000 SMS messages)

### 2. Get Your Credentials
After signing up, navigate to your [Twilio Console](https://console.twilio.com):

1. **Account SID**: Found on the dashboard homepage
   - Format: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - This is your account identifier

2. **Auth Token**: Found on the dashboard homepage (click to reveal)
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Keep this secret!

### 3. Get a Phone Number
1. In the Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Choose a number with SMS capabilities
3. Select a local number or toll-free number
4. Cost: ~$1/month for local, ~$2/month for toll-free
5. Click "Buy" to purchase

Your phone number will be in format: `+1234567890`

### 4. Configure Messaging Service (Optional but Recommended)
1. Go to **Messaging** → **Services**
2. Click "Create Messaging Service"
3. Name it "Personal Brand DNA"
4. Add your phone number to the service
5. Configure settings:
   - Enable "Process inbound messages"
   - Set validity period to 10 minutes
   - Enable delivery receipts

### 5. Add to Vercel Environment Variables

In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add these variables:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### 6. Test Your Configuration

Use this curl command to test (replace with your domain):

```bash
curl -X POST https://your-app.vercel.app/api/phone-auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5551234567",
    "countryCode": "+1"
  }'
```

Expected response:
```json
{
  "message": "OTP sent successfully",
  "expiresAt": "2024-07-01T12:45:00.000Z"
}
```

## 📱 SMS Best Practices

### Message Format
The current message template is:
```
Your Personal Brand DNA verification code is: 123456. It expires in 10 minutes.
```

### Rate Limits
- Trial accounts: 1 message per unique phone number per 4 seconds
- Upgraded accounts: Higher limits based on your plan

### Geographic Restrictions
- Trial accounts can only send to verified phone numbers
- To remove this restriction, upgrade your account

## 🔒 Security Considerations

1. **Never commit Twilio credentials to Git**
   - Use environment variables only
   - Add to `.env.local` for local development

2. **Implement rate limiting**
   - The API already logs attempts
   - Consider adding IP-based rate limiting

3. **Monitor for abuse**
   - Check Twilio logs regularly
   - Set up alerts for unusual activity

## 💰 Cost Estimation

### SMS Pricing (US)
- Outbound SMS: ~$0.0079 per message
- Inbound SMS: ~$0.0075 per message
- Phone number: $1-2/month

### Monthly Estimates
- 100 users/day × 30 days = 3,000 OTP messages
- Cost: ~$24/month + phone number
- Total: ~$25-30/month

## 🚨 Common Issues

### "Invalid phone number"
- Ensure number includes country code
- Format: `+1234567890` (with + prefix)

### "Message not received"
- Check if number is verified (trial accounts)
- Verify Twilio balance
- Check spam folder on phone

### "Authentication error"
- Double-check Account SID and Auth Token
- Ensure environment variables are set correctly

## 📊 Monitoring

### Twilio Console Features
1. **Message Logs**: View all sent messages
2. **Error Logs**: Debug failed messages
3. **Usage Triggers**: Set up alerts for usage limits
4. **Insights**: Analytics on delivery rates

### Setting Up Alerts
1. Go to **Monitor** → **Alerts**
2. Create alerts for:
   - Low balance warning
   - High error rate
   - Unusual usage patterns

## 🎯 Next Steps

Once Twilio is configured:
1. ✅ Test OTP sending in development
2. ✅ Verify messages are received
3. ✅ Test OTP verification endpoint
4. ✅ Monitor initial usage
5. ✅ Consider upgrading from trial if needed

## 📞 Support Resources

- **Twilio Docs**: https://www.twilio.com/docs/sms
- **Status Page**: https://status.twilio.com/
- **Support**: support@twilio.com
- **Community**: https://www.twilio.com/community

Remember: Start with the trial account to test everything, then upgrade when ready for production!