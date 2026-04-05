# Operations Runbook

## Purpose
Provide safe operational procedures for backup, restore, reset, and incident response.

## Before You Start
- Operator has owner/admin access.
- Confirm if incident is workspace-scoped or tenant-wide.

## Steps
1. Pre-change checklist:
   - Confirm active workspace
   - Capture current issue/symptoms
   - Take backup (workspace or tenant as appropriate)
2. Backup strategy:
   - Workspace scope for isolated recovery/testing
   - Tenant scope for full-instance rollback
3. Restore strategy:
   - Confirm impact window
   - Use typed confirmation + restored workspace naming
   - Validate critical entities post-restore
4. Destructive action strategy:
   - Prefer reset data before delete workspace
   - Never delete last workspace unless decommissioning tenant

## Expected Result
Operational changes are reversible where possible and scoped safely.

## Common Mistakes
- Running tenant restore for a workspace-only issue.
- Executing destructive action without pre-action backup.

## Related Tasks
- [Danger Zone](./Danger-Zone)
- [Workspace Management](./Workspace-Management)
