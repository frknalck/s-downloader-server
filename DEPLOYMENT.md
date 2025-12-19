# Coolify Deployment Guide

## Quick Start

1. **Push to Git Repository**
   ```bash
   cd smule-downloader-server
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create Service in Coolify**
   - Go to Coolify Dashboard
   - Click "New Service"
   - Select "Docker" or "Dockerfile"
   - Connect your Git repository
   - Select branch: `main`

3. **Configure Service**
   - **Port**: `3000`
   - **Environment Variables**:
     - `PORT=3000`
     - `NODE_ENV=production`
   - **Health Check Path**: `/health`

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Server will be live!

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |

## Verifying Deployment

After deployment, test your server:

```bash
# Health check
curl https://your-domain.com/health

# Test with a Smule URL
curl -X POST https://your-domain.com/api/process \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.smule.com/p/YOUR_PERFORMANCE_ID/YOUR_PERFORMANCE_ID"}'
```

## Monitoring

- **Health Check**: `GET /health`
- **Stats**: `GET /api/stats`
- **Logs**: View in Coolify dashboard

## Automatic Cleanup

Files are automatically deleted 1 hour after download. No manual intervention needed!

## Troubleshooting

### Build Fails
- Check Dockerfile is present
- Verify all dependencies in package.json
- Check Coolify logs for errors

### Server Won't Start
- Verify PORT environment variable
- Check health check endpoint
- Review application logs

### Downloads Fail
- Verify network connectivity to Smule
- Check disk space on server
- Review download logs

## Scaling

For high traffic:
- Increase server resources in Coolify
- Consider using external storage for downloads
- Implement Redis for download tracking

## Updates

To update the server:
```bash
git add .
git commit -m "Update"
git push
```

Coolify will auto-deploy if configured for automatic deployments.
