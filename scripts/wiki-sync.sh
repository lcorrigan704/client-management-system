#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs/wiki"
NAV_FILE="$DOCS_DIR/nav.json"
ASSETS_DIR="$DOCS_DIR/assets"

WIKI_DIR=""
DRY_RUN=false
DO_PUSH=false
SKIP_VALIDATE=false

usage() {
  cat <<USAGE
Usage: scripts/wiki-sync.sh [--wiki-dir PATH] [--dry-run] [--push] [--skip-validate]

Options:
  --wiki-dir PATH   Path to local checked-out GitHub wiki repository.
                    Default: ../<repo-name>.wiki (relative to repo root)
  --dry-run         Show planned file operations without writing changes.
  --push            Commit and push changes in wiki repository.
  --skip-validate   Skip docs validation and index generation.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wiki-dir)
      WIKI_DIR="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --push)
      DO_PUSH=true
      shift
      ;;
    --skip-validate)
      SKIP_VALIDATE=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$WIKI_DIR" ]]; then
  repo_name="$(basename "$ROOT_DIR")"
  WIKI_DIR="$ROOT_DIR/../${repo_name}.wiki"
fi

if [[ "$SKIP_VALIDATE" = false ]]; then
  "$ROOT_DIR/scripts/wiki-build-index.sh"
  "$ROOT_DIR/scripts/wiki-validate.sh"
fi

if [[ "$DRY_RUN" = true ]]; then
  echo "[dry-run] Source docs: $DOCS_DIR"
  echo "[dry-run] Target wiki: $WIKI_DIR"
  node -e "const nav=require(process.argv[1]); for (const p of nav.pages) console.log('[dry-run] copy '+p.file);" "$NAV_FILE"
  echo "[dry-run] copy INDEX.md"
  echo "[dry-run] sync assets/"
  echo "[dry-run] generate _Sidebar.md"
  exit 0
fi

if [[ ! -d "$WIKI_DIR/.git" ]]; then
  echo "Wiki repository not found at: $WIKI_DIR"
  echo "Clone it first, for example:"
  echo "  git clone <repo.wiki.git> $WIKI_DIR"
  exit 1
fi

mkdir -p "$WIKI_DIR/assets"

PAGE_FILES="$(node -e "const nav=require(process.argv[1]); for (const p of nav.pages) console.log(p.file);" "$NAV_FILE")"

while IFS= read -r page; do
  [[ -z "$page" ]] && continue
  cp "$DOCS_DIR/$page" "$WIKI_DIR/$page"
done <<< "$PAGE_FILES"

cp "$DOCS_DIR/INDEX.md" "$WIKI_DIR/INDEX.md"
rsync -a --delete "$ASSETS_DIR/" "$WIKI_DIR/assets/"

node - <<'NODE' "$NAV_FILE" "$WIKI_DIR/_Sidebar.md"
const fs = require('fs');
const navPath = process.argv[2];
const outPath = process.argv[3];
const nav = JSON.parse(fs.readFileSync(navPath, 'utf8'));

const groups = new Map();
for (const page of nav.pages) {
  if (!groups.has(page.group)) groups.set(page.group, []);
  groups.get(page.group).push(page);
}

let out = '# Wiki Navigation\n\n';
for (const [group, pages] of groups.entries()) {
  out += `## ${group}\n`;
  for (const page of pages) {
    const stem = page.file.replace(/\.md$/i, '');
    out += `- [${page.title}](${stem})\n`;
  }
  out += '\n';
}
fs.writeFileSync(outPath, out);
NODE

echo "Wiki files synced to $WIKI_DIR"

if [[ "$DO_PUSH" = true ]]; then
  git -C "$WIKI_DIR" add .
  if git -C "$WIKI_DIR" diff --cached --quiet; then
    echo "No wiki changes to commit."
    exit 0
  fi

  stamp="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  git -C "$WIKI_DIR" commit -m "docs: sync wiki from repo ($stamp)"
  git -C "$WIKI_DIR" push
  echo "Wiki changes pushed."
fi
