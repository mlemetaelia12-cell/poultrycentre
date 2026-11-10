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
- Dashboard notifications, paginated/searchable audit history, Sales History and CSV exports.
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
- The supplied manifest currently declares Next.js `^16.4.5`, React/React DOM `19.2.9`, and `eslint-config-next` `15.5.6`. Review and align framework/tooling versions before production deployment; do not upgrade dependencies blindly.
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

## Current implementation and verification status (7 November 2026)

This archive is an incremental improvement to the supplied source project. It preserves the existing PostgreSQL schema and business services, and adds one additive migration: `drizzle/0002_operation_requests.sql` creates an idempotency-request table used to protect sales, purchase receiving, debt repayments and expense submissions from duplicate retries. The migration does not drop or rewrite existing tables, columns or business records. Review the database and take a restorable backup before running `npm run db:migrate` against any non-disposable database.

Implemented in this working copy:

- Duplicate-submission protection for sales, purchase receiving, debt repayments and expenses; successful POS/purchase forms clear their submitted details and rotate the request key.
- POS product search across product names, SKU and barcode.
- A dedicated paginated Sales History with business-local date filters, search, sale-line pricing/discount details, payment methods and receipt links.
- A searchable, filterable, paginated Audit Log with expandable event details; historical events are retained.
- Customer debt repayment history in the Debt Management screen.
- Product registration's less frequently used attributes moved into an optional details section; underlying fields remain available.
- Responsive table containment and wrapping improvements without applying a global horizontal-overflow hiding rule.
- English/Kiswahili switching is available in the application header and is retained across visits. The primary daily workflows, sales, receipts, debts, expenses, products, customers, staff and stock receiving have translated labels; less-used legacy administration screens may still contain English text.

Verification performed for this delivery (10 November 2026):

- TypeScript/TSX parser scan: 51 source files checked, zero syntax diagnostics.
- Dependency installation (`npm ci`) was attempted but did not complete in this environment. Therefore, dependency-based typecheck, lint, Vitest and production build are not certified for this revision.
- Database schema and migration files were compared with the supplied archive and are byte-for-byte unchanged. No database command was run.
- Browser/device QA was not performed; confirm the POS, print dialog and mobile owner dashboard on the target shop devices before production use.

On the target computer, install dependencies with `npm ci`, then run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Do not run database migrations or bootstrap scripts against the existing business database as part of this UI update.
The supplied archive contained local environment files and installed dependencies. This delivery archive excludes `.env`, `.git`, `node_modules`, `.next` and generated build caches. Only `.env.example` is included; it contains placeholders, not real secrets.


