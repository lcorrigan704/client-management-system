# Danger Zone

## Purpose
Safely operate destructive and recovery actions with explicit scope controls.

## Before You Start
- Confirm active workspace.
- Take a backup before any destructive action.

## Steps
1. Open Settings > Danger zone.
2. Use Workspace danger for active workspace operations:
   - Reset business data (workspace only)
   - Delete workspace (typed workspace name confirmation)
3. Use System danger for backup/restore:
   - Create backup with scope:
     - Active workspace only
     - Entire tenant (all workspaces)
   - Restore backup with typed company confirmation and restored workspace name.

## Expected Result
Only intended scope is affected, with typed confirmations reducing accidental data loss.

## Common Mistakes
- Running tenant restore when only workspace restore intent exists.
- Attempting to delete last remaining workspace (blocked).

## Related Tasks
- [Workspace Management](./Workspace-Management)
- [Operations Runbook](./Operations-Runbook)
