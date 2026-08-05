# Exam Sprint-only mode

Exam Sprint-only mode temporarily focuses the public JabuStudy experience on `/exam` without deleting or migrating any Study Hub data.

## Activate

Set this server-side deployment variable and redeploy:

```env
EXAM_SPRINT_ONLY_MODE=true
```

The switch defaults to `false`. Set it to `false` (or remove it) and redeploy to restore the full Study system.

## What remains available

- Exam Sprint pages and APIs under `/exam` and `/api/exam`
- Login, signup, auth callback, support and the offline screen
- The Exam Sprint checkout, payment callbacks and receipts
- Protected staff tools under `/study-admin` and `/api/study-admin`
- Health checks, cron routes and Paystack webhooks

Public Study Hub pages redirect to `/exam`. Paused APIs return HTTP `423` with code `SYSTEM_MODE_RESTRICTED`. Auth return URLs that point into the paused Study Hub are sanitized to `/exam`.

Only `plus_monthly`, the 30-day Exam Sprint pass, can be created or resumed while the mode is active. Existing payment verification and fulfilment routes stay online so switching modes cannot strand a payment.

## Verification

Run:

```bash
npm test
EXAM_SPRINT_ONLY_MODE=true npm run build
```

No database migration is required. The restriction is enforced at the application page/API gateway, and the existing Study data remains intact for restoration.
