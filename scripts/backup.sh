#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/cms-$(date +%F).tar.gz" \
  "$ROOT_DIR/backend/app.db" \
  "$ROOT_DIR/backend/public/uploads"

echo "Backup created at $BACKUP_DIR"
