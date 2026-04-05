# Documentation Standards

## Purpose
Define how wiki docs are authored, reviewed, and maintained.

## Before You Start
- Source-of-truth is repo docs under docs/wiki.
- Wiki pages are generated/synced from this directory.
- Use file names in `Title-Case-With-Hyphens.md`.

## Steps
1. Create or update page using templates in docs/wiki/_templates.
2. Ensure every task page includes sections:
   - Purpose
   - Before You Start
   - Steps
   - Expected Result
   - Common Mistakes
   - Related Tasks
3. Add page to docs/wiki/nav.json.
4. If UI changed materially, add/update screenshot in docs/wiki/assets.
5. Keep labels/status names exactly aligned to in-app text.
6. Add workspace vs tenant scope notes for any behavior that can differ by scope.
7. Run docs checks and wiki sync dry-run:
   - `bash scripts/wiki-build-index.sh`
   - `bash scripts/wiki-validate.sh`
   - `bash scripts/wiki-sync.sh --dry-run`
8. Sync to GitHub Wiki when ready:
   - `bash scripts/wiki-sync.sh --wiki-dir ../<repo>.wiki`
   - add `--push` to commit/push wiki repo changes.

## Expected Result
Docs remain consistent, discoverable, and safe to publish to wiki.

## Common Mistakes
- Adding page without nav.json entry.
- Using UI labels that do not match current product text.
- Adding excessive screenshots where simple steps are clearer.
- Forgetting to update freshness ownership/date table.

## Related Tasks
- [Docs Freshness](./Docs-Freshness)
- [Home](./Home)
