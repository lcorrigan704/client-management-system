# PR: Agreement/Proposal Versioning + Field Comments

## Summary
- Add version history with restore for agreements and proposals.
- Introduce field-level comments with mentions, status, and reactions.
- Improve wizard UX with explicit save and dirty-state indicators.

## Key changes
- Backend: version/comment tables, comment metadata (mentions, implemented), restore endpoints, and user search for @mentions.
- Frontend: version history dialog, comments dialog with all-versions toggle + badges, mention popover, and comment count indicators.
- Wizard: explicit save only on final step, “Unsaved changes” badge, and no-change close with toast.

## Testing
- Edit an agreement/proposal, view version history, restore a prior version.
- Add a comment, toggle “All versions,” and verify version badges + current-version chip.
- Use @ to mention a user and verify highlight + mention list.
- Verify “No changes to save” toast and disabled update when unchanged.
