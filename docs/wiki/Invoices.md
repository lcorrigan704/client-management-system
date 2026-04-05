# Invoices

## Purpose
Manage invoice lifecycle including line items, status, payments, reminders, PDF, and email composition.

## Before You Start
- Active workspace and FY filter are correct.
- Client exists.

## Steps
1. Open Revenue > Invoices.
2. Create invoice for selected client.
3. Use line items dialog to add/edit/remove line items.
4. Set dates, status, recurrence options, and notes.
5. Save invoice.
6. Optional actions:
   - Mark paid / add payments
   - Generate PDF
   - Compose email/send via Emails workspace
   - Send reminders (single or bulk)
7. Edit or delete via row actions when needed.

## Expected Result
Invoice totals, status, and payment state are updated; email/PDF actions succeed when configured.

## Common Mistakes
- Sending reminders without SMTP configured.
- Using incorrect invoice date while FY filtering is active.

## Related Tasks
- [Emails Workspace](./Emails-Workspace)
- [Tax Workspace](./Tax-Workspace)
- [Revenue Adjustments](./Revenue-Adjustments)
