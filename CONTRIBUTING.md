# Contributing

Thanks for your interest in contributing! This project aims to stay lightweight, easy to self‑host, and accessible to non‑experts.

## Quick start (local dev)
```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>

# backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Branching
- Create a feature branch from `main`:
  - `feat/<short-name>`
  - `fix/<short-name>`
  - `chore/<short-name>`

## Pull requests
- Keep PRs focused and small.
- Describe what changed and why.
- Include screenshots for UI changes.
- Note any new env vars or migrations.

## Code style
- Prefer clear, boring code over clever code.
- Avoid inline styles in frontend; use the shared design system.
- Add tests where practical.

## Reporting issues
- Use GitHub issues.
- Provide reproduction steps and logs.

## Security
Do not open public issues for security vulnerabilities. See `SECURITY.md` for responsible disclosure.
