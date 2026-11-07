# POULTRY CENTRE

A private, single-shop veterinary and poultry medicines business-management application. The interface is English-first, uses TZS and the `Africa/Dar_es_Salaam` timezone, and includes a custom inline SVG brand mark and `/icon.svg` favicon. There is no splash screen and no generated image dependency.

## Included modules

- Username/password authentication, Argon2id password hashing, first-owner bootstrap and staff account management.
- Roles: Owner, Manager, Cashier and Stock Attendant, enforced on the server.
- Product catalogue, categories, SKU/barcode fields, retail and wholesale prices, minimum selling price and product-specific unit conversions.
- Supplier receiving, purchase invoices/references, paid purchase records, batches, expiry dates, stock movements and FEFO sales allocation.
- POS with retail/wholesale pricing, barcode/SKU lookup (keyboard-wedge scanners), basket, discounts, split payments, walk-in customers and customer credit.
- Customer accounts, credit limits, debt ledger and partial repayments.
- Cashier shifts, cash reconciliation and discrepancy alerts.
- Expenses, sales reports, collections, COGS, profit, stock valuation and potential dead-stock reporting.
- Internal receipts with 80 mm and A4 print layouts; browser printing can also save a PDF.
- Exceptional owner/manager-approved exchanges. Returned products are quarantined and are never automatically returned to sellable batches.
- Dashboard notifications, audit history and CSV exports.
- Responsive owner dashboard session for mobile; desktop workspace for authorised business operations.

## Important business rules

- A single business/shop is configured. Multi-branch operations are not part of V1.
- Suppliers are recorded as paid immediately. Supplier-credit accounts are not implemented.
- Customers may buy on credit subject to their configured credit limit. A sale can store an optional agreed due date; overdue invoices are surfaced separately.
- Supplier purchases are inventory purchases and are not double-counted as operating expenses. Gross profit is net sales less COGS; net profit is gross profit less recorded operating expenses.
- Product unit conversions are configured per product. No generic carton/bottle conversion is assumed.
- Expired batches are excluded from POS allocation. FEFO allocates the earliest-expiring eligible batch first.
- An ordinary customer return is not accepted. Exceptional exchanges require owner/manager approval and the returned item goes into quarantine.
- The cancellation workflow is limited to completely unpaid credit sales. Paid or partially paid sales need a separately reviewed adjustment/refund workflow; historical sale rows are not deleted.
- Receipts are internal business receipts. They are **not** EFD/VFD fiscal receipts.
- Tax is not calculated automatically. The owner must verify TIN, VAT status and applicable obligations with TRA or a qualified accountant before configuring tax treatment.
- No automated WhatsApp, SMS, email or mobile-money gateway integration is enabled.
- No full offline transaction synchronisation is enabled. The app requires internet access to operate against its database.

## Requirements

- Node.js 20.9+ (Node.js 22 LTS is recommended).
- Next.js is pinned to 15.5.29 (patched November 3, 2026) and React/React DOM to 19.2.9 (patched for the October 14, 2026 React Server Components advisories). Re-check upstream security advisories and update these exact pins before every production deployment.
- A PostgreSQL database (Neon PostgreSQL is suitable).
- npm.

## Local setup (Windows PowerShell)

1. Extract the project and open PowerShell in the `poultry-centre` folder.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Copy environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Create a PostgreSQL database, then put its connection URL into `.env` as `DATABASE_URL`.
5. Generate a unique session secret:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```

   Copy the printed value into `.env` as `APP_SESSION_SECRET`. Do not commit `.env` or share its values.
6. Run the initial database migration:

   ```powershell
   npm run db:migrate
   ```

7. Create the first owner account interactively (there is no default login and no public registration):

   ```powershell
   npm run db:bootstrap-owner
   ```

   Choose a unique username and a strong password of at least 12 characters. Password entry is hidden in the terminal. Keep it private.
8. Start the development server:

   ```powershell
   npm run dev
   ```

9. Open `http://localhost:3000` and sign in with the owner credentials created above.

## Quality checks

Run these commands after dependencies are installed:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Do not deploy to production until all five checks pass against the exact code being deployed and the database migration has been tested against a non-production database first.

## Production deployment

Set `DATABASE_URL` and `APP_SESSION_SECRET` in the hosting provider's protected environment-variable settings. Generate a separate strong session secret for production. Use a PostgreSQL URL with TLS. Apply migrations intentionally before exposing the app to staff, then create the first owner interactively from a trusted environment. Do not include a real `.env` file in Git or the deployment archive.

Back up the database before production migrations and rehearse restoring a backup into a separate database. Confirm that the restored database can start the app and that receipts, sale history, stock batches, debt balances and audit logs reconcile.

## Security notes and production gates

- Passwords are hashed with Argon2id; the app never stores a default owner password.
- Session identifiers are random bearer tokens; only HMAC-SHA256 hashes are stored in PostgreSQL. Cookies are HttpOnly, SameSite=Lax and Secure in production.
- Authentication attempts are rate-limited by a keyed username/IP hash.
- Server-side role checks guard write actions. Financial and stock movements are performed within database transactions where multiple records must change together.
- Audit history is append-only through application workflows; there are no ordinary delete controls for sales, payments, expenses or audit events.
- The database has uniqueness guards for owner bootstrap, product SKU, product barcode, unit names/barcodes, receipt numbers and one open cashier shift per user.
- Important limitation: the current mobile-versus-desktop decision uses the browser User-Agent plus the server-stored session access mode. This blocks ordinary mobile sessions and their write actions, but User-Agent strings can be spoofed; browsers do not provide reliable hardware-backed device attestation. For a strict high-assurance device boundary, deploy a trusted-device enrolment/approval flow or managed-device policy before relying on this as a security guarantee.
- Configure production HTTPS, restrict database credentials, enable managed database backups and monitor failed sign-ins. Revoke user sessions when an account is disabled.
- Barcode support assumes a USB/Bluetooth keyboard-wedge scanner; no camera scanning permission is enabled.

## Current delivery status

This archive is a newly generated application source project and database migration. It has not been connected to the owner's real PostgreSQL database, and no production credentials are included. In the generation environment, npm registry access timed out, so dependencies could not be installed; therefore a Next.js production build, ESLint run, TypeScript typecheck and Vitest execution could not be truthfully certified here. Static checks completed here: 55 TypeScript/TSX files parsed with zero syntax errors; all local source imports resolved; all 26 Drizzle tables and their columns matched the SQL migration; the SVG favicon parsed as valid XML; and five financial-helper smoke checks passed manually. These checks are not a substitute for a real package typecheck/build, ESLint, Vitest run, PostgreSQL migration test or dependency audit. Run the quality commands above after `npm install` and address any toolchain/type errors before production use.

The initial UI includes the English interface and a Kiswahili language preference for the navigation/dashboard strings. The remaining detailed operational-page copy is currently English; full translation of every field, message, report and receipt is still a required completion task before advertising full bilingual coverage.
