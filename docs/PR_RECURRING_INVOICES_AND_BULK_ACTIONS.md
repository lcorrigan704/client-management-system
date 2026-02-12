# PR: Recurring invoices + bulk row actions

## Summary
- Add recurring invoice scheduling with frequency, occurrences, and due‑date rules, plus optional “send first invoice now”.
- Improve SMTP tooling with a test connection endpoint and UI action.
- Add DataTable row selection with bulk actions and confirmation dialogs across all entities.

## Key changes
- Recurring invoice flow generates multiple invoices on create and supports optional SMTP send of the first invoice.
- SMTP test endpoint with logging for active host/port/TLS/username config.
- DataTable gains selectable rows, select‑all header checkbox, and reusable bulk actions UI.

## Testing
- Create invoice with recurrence on/off and verify generated invoices + IDs.
- Test “send first invoice now” with SMTP configured.
- Use bulk actions to delete and send reminders across tables.
