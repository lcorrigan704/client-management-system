# Deployment Notes

## Overview
This app is designed to run with:
- FastAPI backend
- React/Vite frontend
- SQLite database

## Reverse proxy
Nginx is recommended but not required. Any reverse proxy can be used.

## Backups
- SQLite DB: back up `backend/app.db` (or `backend/data/app.db` if using Docker).
- Uploads: back up `backend/public/uploads`.

Suggested cron backup:
```bash
tar -czf backups/cms-$(date +%F).tar.gz backend/app.db backend/public/uploads
```

## SSL
For production, terminate TLS at your reverse proxy and set:
```
SESSION_SECURE=true
```

## Data retention
This app stores client data locally. Ensure you comply with applicable data protection laws in your jurisdiction.
