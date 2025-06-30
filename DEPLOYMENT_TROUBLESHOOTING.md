# Deployment Troubleshooting Guide

## Current Issues

### 1. Blank Page on https://personal-brand-dna.vercel.app/

**Symptoms:**
- Page loads with HTML but shows blank content
- JavaScript files are loading (main.b0cad181.js)
- API endpoints return 500 errors on consolidated endpoints

**Possible Causes:**
1. **React Router Issue**: The app might be trying to route to a page that doesn't exist
2. **API URL Mismatch**: Frontend might be pointing to wrong API endpoints
3. **Environment Variables**: Missing environment variables in Vercel deployment
4. **Redux Store Error**: Possible error in Redux initialization

### 2. API Endpoint Issues

**Working:**
- `/api/hello` - Returns 200 OK with success message

**Not Working:**
- `/api/auth?action=demo-login` - Returns 500 FUNCTION_INVOCATION_FAILED
- Other consolidated endpoints - Return 404 or 500

**Root Cause:**
The consolidated API functions are deployed but failing at runtime, likely due to:
- Missing environment variables
- Import path issues in serverless environment
- Database connection problems

## Solutions to Try

### 1. Check Browser Console
Open browser developer tools and check for JavaScript errors that might explain the blank page.

### 2. Environment Variables
Ensure these are set in Vercel dashboard:
```
REACT_APP_API_URL=https://personal-brand-dna.vercel.app
DATABASE_URL=<your-supabase-url>
REDIS_URL=<your-upstash-url>
JWT_SECRET=<your-jwt-secret>
OPENAI_API_KEY=<your-openai-key>
```

### 3. Test Simple API
Create a minimal test endpoint to isolate the issue:

```javascript
// api/test-simple.js
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Simple test working',
    method: req.method,
    query: req.query
  });
}
```

### 4. Check Vercel Logs
1. Go to https://vercel.com/dashboard
2. Find your project
3. Click on "Functions" tab
4. Check logs for error details

### 5. Fallback to Old Endpoints
Since the old endpoints still work on the other deployment, you can:
1. Revert to individual API files temporarily
2. Or update frontend to use the working deployment URL

## Quick Fixes

### For Blank Page:
1. Add a fallback route in App.tsx
2. Check if Redux store is initializing properly
3. Ensure all required environment variables are set

### For API Errors:
1. Check Vercel function logs for specific error
2. Test with minimal endpoint first
3. Gradually add complexity to isolate issue

## Next Steps

1. **Check Vercel Dashboard** for deployment status and error logs
2. **Test API endpoints** individually to find which ones work
3. **Review environment variables** in Vercel settings
4. **Consider reverting** to individual API files if consolidation is causing issues