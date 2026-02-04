#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Setting up backend"
cd "$ROOT_DIR/backend"
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

echo "==> Setting up frontend"
cd "$ROOT_DIR/frontend"
npm install

echo "==> Done."
echo "Run backend: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "Run frontend: cd frontend && npm run dev"
