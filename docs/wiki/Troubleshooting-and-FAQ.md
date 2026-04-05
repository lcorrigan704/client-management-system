# Troubleshooting and FAQ

## Purpose
Resolve common usage and environment issues quickly.

## Before You Start
- Confirm active workspace and role.
- Capture exact error text and action path.

## Steps
1. For UI request failures:
   - Verify backend is running.
   - Verify frontend proxy config includes endpoint path.
   - Refresh auth session.
2. For migration issues:
   - Run alembic upgrade heads.
   - Confirm migration head state.
3. For dev port conflicts:
   - Free ports 8000/5173.
   - Restart setup script.
4. For email send issues:
   - Re-test SMTP.
   - Check recipient fields and logs.

## Expected Result
User can identify root cause category and apply corrective action.

## Common Mistakes
- Ignoring workspace context when investigating missing records.
- Expecting backend logs when requests never hit API (proxy misconfiguration).

## Related Tasks
- [Settings](./Settings)
- [Danger Zone](./Danger-Zone)
- [Operations Runbook](./Operations-Runbook)
