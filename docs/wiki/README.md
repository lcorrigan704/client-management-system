# Wiki Docs (Repo Source of Truth)

This directory is the source-of-truth for end-user/operator documentation.

## Structure
- `nav.json`: ordered page manifest used for wiki sync and sidebar generation.
- `_templates/`: authoring templates.
- `assets/`: screenshots/media referenced by pages.
- `*.md`: task-based wiki pages.

## Local Workflow
1. Edit pages and assets.
2. Rebuild generated index:
   - `bash scripts/wiki-build-index.sh`
3. Validate docs:
   - `bash scripts/wiki-validate.sh`
4. Dry-run wiki sync:
   - `bash scripts/wiki-sync.sh --dry-run`

## Publish to GitHub Wiki
1. Clone wiki repo locally (one-time):
   - `git clone <repo.wiki.git> ../<repo>.wiki`
2. Sync docs:
   - `bash scripts/wiki-sync.sh --wiki-dir ../<repo>.wiki`
3. Sync and push:
   - `bash scripts/wiki-sync.sh --wiki-dir ../<repo>.wiki --push`
