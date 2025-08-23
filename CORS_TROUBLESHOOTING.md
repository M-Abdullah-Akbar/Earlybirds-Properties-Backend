# Fixing CORS Issues with Vercel Backend

## The Problem

You're seeing CORS errors in your admin portal console similar to:

```
Access to XMLHttpRequest at 'https://earlybirds-properties-backend.dxs4k12y.vercel.app/api/properties?limit=10' from origin 'https://vocal-genie-167c56.netlify.app' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## The Solution

### 1. Update Environment Variables in Vercel

You need to make sure your Vercel deployment has the correct environment variables set for CORS:

1. Log in to your Vercel dashboard
2. Select your backend project
3. Go to Settings > Environment Variables
4. Add or update the following environment variables:

```
Admin_URL=https://vocal-genie-167c56.netlify.app
User_URL=[your-user-portal-netlify-url]
BASE_URL=https://earlybirds-properties-backend.dxs4k12y.vercel.app
```

5. Redeploy your backend application

### 2. Verify CORS Configuration

The CORS configuration in your backend's `server.js` is already set up correctly to allow requests from the origins specified in the environment variables:

```javascript
const allowedOrigins = [
  process.env.Admin_URL,
  process.env.User_URL,
  process.env.BASE_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);
```

### 3. Check for Typos in URLs

Ensure there are no typos in your environment variables. The URLs must match exactly:

- The URL in your browser when accessing the admin portal should match the `Admin_URL` environment variable
- The URL in your browser when accessing the user portal should match the `User_URL` environment variable

### 4. Vercel Serverless Function Limitations

Vercel serverless functions have some limitations that might affect CORS:

1. Cold starts: The first request might fail due to cold start issues
2. Environment variables: Changes to environment variables require redeployment

### 5. Alternative Solution: Add Netlify URL Directly

If the above steps don't resolve the issue, you can modify your backend code to explicitly include your Netlify URL:

```javascript
const allowedOrigins = [
  process.env.Admin_URL,
  process.env.User_URL,
  process.env.BASE_URL,
  "https://vocal-genie-167c56.netlify.app", // Add your admin portal URL directly
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);
```

This change would need to be committed to your repository and redeployed to Vercel.

### 6. Debugging

To debug CORS issues:

1. Add console logs in your backend to print the allowed origins and the origin of incoming requests
2. Check the Network tab in your browser's developer tools to see the exact request headers
3. Verify that the `Origin` header in the request matches one of your allowed origins

### 7. Temporary Testing Solution

For testing purposes only (not recommended for production), you could temporarily allow all origins:

```javascript
app.use(cors());
```

This would bypass all origin checks but should only be used for testing to confirm if CORS is indeed the issue.