# Client Management System (CMS)

Client and finance management system with a React + Vite frontend and a FastAPI backend backed by SQLite. Includes invoices, quotes, proposals, agreements, expenses, PDF generation, email drafts, and a built-in auth + onboarding flow.

## Features
- Clients, invoices, quotes, proposals, agreements, expenses
- Line items for invoices/quotes
- PDF generation for invoices, quotes, agreements, proposals, and expenses
- Email drafts + optional SMTP send
- Settings for prefixes, financial dates, bank details, SMTP
- Role-based access: owner, admin, user
- One-time setup wizard
- Supporting documentation uploads for proposals (stored locally)

## Structure
- `frontend/` React + Vite + Tailwind + shadcn/ui
- `backend/` FastAPI + SQLAlchemy + Alembic + SQLite

## Requirements
- Python 3.11+ (3.12 recommended)
- Node 18+
- WeasyPrint system deps (PDF rendering)
  - macOS: `brew install pango libffi`
  - Ubuntu/Debian: `sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 libffi8`
- A reverse proxy for production (Nginx recommended). Any reverse proxy/WAF can be used based on your hosting requirements.

## Local development (recommended first run)
Start the API:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`

### One‑click setup (macOS/Linux)
```bash
./scripts/setup.sh
```

## Backend setup (manual)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

API docs: `http://localhost:8000/docs`

### Backend environment
Create `backend/.env` (see `backend/.env.example`):
```env
APP_SECRET=change-me-to-a-long-random-string
DATABASE_URL=sqlite:///./app.db
SESSION_TTL_HOURS=72
SESSION_SECURE=false
ALLOWED_ORIGINS=http://localhost:5173

# Optional SMTP defaults (can also be set in-app)
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_USE_TLS=true
```
`APP_SECRET` is used to encrypt sensitive values at rest (e.g. SMTP password) and to sign session cookies. Set this to a long, random value (32+ characters, mixed case + numbers + symbols recommended).

## Frontend setup (manual)
```bash
cd frontend
npm install
npm run dev
```

Optional frontend environment (see `frontend/.env.example`):
```env
VITE_API_URL=http://localhost:8000
```

## First-run onboarding
If no users exist, the app shows a setup wizard:
1) Create owner account
2) Company profile
3) Financial dates
4) Bank details (optional)
5) SMTP settings (optional)

After setup, login with the owner account.

## Roles
- `owner`: full access + user management + settings
- `admin`: full access to entities, no user management
- `user`: full access to entities, no user management or settings

## PDFs and email drafts
- PDFs are generated server-side for invoices, quotes, agreements, proposals, and expenses.
- Email drafts are created with `POST /email/draft`.
- SMTP password is encrypted at rest; user passwords are hashed (Argon2).

## Self-hosting notes
- Frontend and backend are designed to run on the same origin (recommended for cookies).
- Set `SESSION_SECURE=true` when using HTTPS.
- Ensure `APP_SECRET` is set to a strong, unique value.
- Persist `backend/public/uploads` and your SQLite DB.

## Production (single server)
1) Backend (systemd or a process manager):
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2) Frontend build:
```bash
cd frontend
npm install
npm run build
```

3) Serve the frontend build and proxy API:
- Serve `frontend/dist` with Nginx, Caddy, or any static host.
- Proxy `/api` (or all `/`) to `http://127.0.0.1:8000`.
- Update `VITE_API_URL` if the API is on a different origin.

### Nginx (example)
```nginx
server {
  listen 80;
  server_name your-domain.com;

  root /var/www/cms/frontend/dist;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Other reverse proxies/WAFs can be used based on your environment.

## Docker (backend only)
```bash
docker compose up --build
```
This runs the API on port `8000` with a persistent SQLite volume at `backend/data/app.db`.

### Docker (backend only)
```bash
docker compose up --build
```
This runs the API on port `8000` with a persistent SQLite volume at `backend/data/app.db`.

### Static uploads
Proposal attachments are stored under `backend/public/uploads` and served at `/uploads/...`.
This directory should be persisted in production.

## Resetting local data
```bash
python backend/scripts/reset_db.py
```
This removes `backend/app.db` and clears `backend/public/uploads`.

## Security notes
- Passwords are hashed with Argon2.
- SMTP passwords are encrypted at rest using `APP_SECRET`.
- Set `APP_SECRET` in `backend/.env` before first run; changing it later will invalidate stored SMTP credentials and sessions.
- `SESSION_SECURE` must be `true` behind HTTPS.
- `APP_SECRET` strength is user‑set; weak secrets weaken SMTP encryption at rest.
- No account lockout or MFA (expected for MVP; add these for public deployments).
- You can disable API docs in production via `ENABLE_DOCS=false`.
- Login rate limiting is configurable via `LOGIN_RATE_LIMIT_ATTEMPTS` and `LOGIN_RATE_LIMIT_WINDOW_SECONDS`.
- Upload size limits are configurable via `MAX_UPLOAD_MB` (also enforce at your reverse proxy).

## Backups
Preferred: run the helper script:
```bash
./scripts/backup.sh
```

Manual alternative (SQLite DB + uploads directory):
```bash
tar -czf backups/cms-$(date +%F).tar.gz backend/app.db backend/public/uploads
```
If you use Docker, back up `backend/data/app.db` instead.
Backups include proposal attachments and expense receipts stored in `backend/public/uploads`.

## License and warranty
This project is open-source and provided “as is”, without warranty of any kind. Use at your own risk.
