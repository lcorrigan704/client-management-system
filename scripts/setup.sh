#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

kill_listening_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "==> Releasing port ${port} (PIDs: ${pids//$'\n'/, })"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.5
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

echo "==> Setting up backend"
cd "$BACKEND_DIR"
if [[ ! -d .venv ]]; then
  python -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
deactivate

echo "==> Setting up frontend"
cd "$FRONTEND_DIR"
npm install

echo "==> Starting backend and frontend"

cleanup() {
  if [[ "${CLEANUP_DONE:-0}" == "1" ]]; then
    return
  fi
  CLEANUP_DONE=1
  local code="${1:-0}"
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
  return "$code"
}

trap 'cleanup 0; exit 0' INT TERM
trap 'cleanup $?' EXIT

kill_listening_port "$BACKEND_PORT"
kill_listening_port "$FRONTEND_PORT"

(
  cd "$BACKEND_DIR"
  source .venv/bin/activate
  exec uvicorn app.main:app --reload --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --port "$FRONTEND_PORT" --strictPort
) &
FRONTEND_PID=$!

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID" 2>/dev/null || true
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    wait "$FRONTEND_PID" 2>/dev/null || true
    break
  fi
  sleep 1
done
