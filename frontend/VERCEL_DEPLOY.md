# Vercel Deployment Guide for COK Systems Frontend

## Quick Deploy

1. **Push your code to GitHub** (main branch)
2. **Go to Vercel.com** → Sign in with GitHub
3. **Import Project** → Select your GitHub repository
4. **Configure Project**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Deploy** → Wait for build to complete
6. **Your site is live at**: `https://your-project.vercel.app`

## Setting Up GitHub Deploy Hooks

To auto-deploy when you push to GitHub:

1. **In Vercel Dashboard**:
   - Go to your project → Settings → Git
   - Under "Deploy Hooks", create a new hook
   - Name: `GitHub Push`
   - Hook URL will be: `https://api.vercel.com/v1/integrations/deploy/prj_xxxxxxxx/hook_xxxxxxxx`

2. **In GitHub Repository**:
   - Go to Repository → Settings → Webhooks
   - Add Webhook:
     - Payload URL: Paste the Vercel hook URL
     - Content type: `application/json`
     - Events: Just the `push` event

3. **Now every push to GitHub will automatically trigger a Vercel deployment**

## Environment Variables

The frontend expects these environment variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://cok-bc.onrender.com/cok/api` |

This is already configured in `vercel.json` under the `env` section.

## Manual Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd frontend
vercel --prod
```

## Troubleshooting

- **Build fails**: Check that `npm run build` works locally
- **API not connecting**: Verify `VITE_API_URL` is set correctly in Vercel project settings
- **CORS issues**: The backend at `cok-bc.onrender.com` should allow CORS from your Vercel domain
