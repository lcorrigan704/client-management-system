#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs/wiki"
NAV_FILE="$DOCS_DIR/nav.json"

if [[ ! -f "$NAV_FILE" ]]; then
  echo "nav.json not found at $NAV_FILE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for docs validation"
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  HAS_RG=true
else
  HAS_RG=false
fi

PAGE_FILES="$(node -e "const nav=require(process.argv[1]); for (const p of nav.pages) console.log(p.file);" "$NAV_FILE")"

required_sections=(
  "## Purpose"
  "## Before You Start"
  "## Steps"
  "## Expected Result"
  "## Common Mistakes"
  "## Related Tasks"
)

errors=0

while IFS= read -r page; do
  [[ -z "$page" ]] && continue
  path="$DOCS_DIR/$page"
  if [[ ! -f "$path" ]]; then
    echo "Missing page from nav.json: $path"
    ((errors++))
    continue
  fi

  for section in "${required_sections[@]}"; do
    if [[ "$HAS_RG" = true ]]; then
      section_exists=false
      if rg -q "^${section}$" "$path"; then
        section_exists=true
      fi
    else
      section_exists=false
      if grep -Eq "^${section}$" "$path"; then
        section_exists=true
      fi
    fi

    if [[ "$section_exists" = false ]]; then
      echo "Missing section '$section' in $path"
      ((errors++))
    fi
  done

done <<< "$PAGE_FILES"

MARKDOWN_FILES="$(find "$DOCS_DIR" -maxdepth 1 -type f -name '*.md' | sort)"

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  while IFS= read -r link; do
    target="${link#*](}"
    target="${target%)}"
    target="${target%%#*}"
    target="${target%%\?*}"

    [[ -z "$target" ]] && continue
    [[ "$target" =~ ^https?:// ]] && continue
    [[ "$target" =~ ^mailto: ]] && continue
    [[ "$target" =~ ^# ]] && continue

    if [[ "$target" == ./* ]]; then
      resolved="$DOCS_DIR/${target#./}"
      if [[ ! -e "$resolved" && ! -e "${resolved}.md" ]]; then
        echo "Broken local link in $file -> $target"
        ((errors++))
      fi
    fi
  done < <(grep -Eo '\[[^]]+\]\([^)]+\)' "$file" || true)
done <<< "$MARKDOWN_FILES"

if [[ "$errors" -gt 0 ]]; then
  echo "Docs validation failed with $errors issue(s)."
  exit 1
fi

echo "Docs validation passed."
