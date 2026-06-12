# Render Deployment Guide

## Backend Deployment

1. **Connect GitHub Repository**
   - Go to https://render.com/dashboard
   - Click "New +"  → "Web Service"
   - Connect your GitHub account and select `open-sch-yachal` repo
   - Select "Node"

2. **Configure Backend Service**
   - **Name:** `open-sch-yachal-backend`
   - **Build Command:** `npm install && npm run build 2>/dev/null || true`
   - **Start Command:** `node server.js`
   - **Region:** Choose closest to your users

3. **Add Environment Variables** in Render Dashboard:
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
   MONGODB_DB_NAME=open-school-yachal
   CLIENT_URL=https://register.yachalhousegh.com,https://open-sch-yachal.pages.dev
   ADMIN_TOKEN=<generate-a-long-random-token>
   RESEND_API_KEY=<resend-api-key>
   RESEND_FROM_EMAIL=noreply@yachalhousegh.com
   REGISTRATION_NOTIFICATION_EMAILS=maamekrakuezoom@gmail.com,blackbird77ad@gmail.com
   ```

   Add and verify `yachalhousegh.com` (or a sending subdomain) in Resend before using that sender address. Create the API key in Resend and store it only in Render and the local ignored `backend/.env` file.

4. **Deploy**
   - Click "Create Web Service"
   - Render will auto-deploy on every push to main

## Frontend Deployment

1. **Create Static Site**
   - In Render Dashboard: "New +" → "Static Site"
   - Connect same GitHub repo
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish Directory:** `client/dist`

2. **Update API Base URL**
   - The current production API is `https://open-sch-yachal.onrender.com`.
   - Update `client/.env.production` with:
     ```
     VITE_API_BASE=https://open-sch-yachal.onrender.com
     ```

3. **Deploy Frontend**
   - Click "Create Static Site"

## Testing Locally Before Deploy

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd client
npm run dev
```

Visit `http://localhost:5173` and test registration form.
