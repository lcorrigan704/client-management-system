# Emails Workspace

## Purpose
Use the multi-entity composer to generate grouped drafts and send operational emails with attachments.

## Before You Start
- SMTP configured in Settings for send actions.
- Active workspace is correct.

## Steps
1. Open Operations > Emails.
2. Select entities (invoice, quote, proposal, agreement, expense).
3. Generate drafts.
4. Review client-grouped drafts.
5. Edit recipient, subject, and body per group.
6. Use actions menu per draft:
   - Send via SMTP
   - Copy body / subject+body
   - Open mail client
   - Download attachments
7. Use Send All with confirmation dialog for batch dispatch.
8. Review email logs; resend or mark delivered (single/bulk).

## Expected Result
Drafts are grouped by client, send results are visible, and audit logs are retained in app.

## Common Mistakes
- Sending without recipient email configured.
- Expecting one global send failure to block all other groups (partial success is possible).

## Related Tasks
- [Invoices](./Invoices)
- [Quotes](./Quotes)
- [Proposals](./Proposals)
- [Service Agreements](./Service-Agreements)
- [Expenses](./Expenses)
