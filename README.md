# SAHARA wallet

Tokenized assets platform for Africa. Full product design (roles, architecture, user/staff flows, roadmap) lives in `SAHARA_Platform_Design.docx` on the project's shared drive — this repo is the implementation.

## Structure

```
apps/
  web/      Next.js frontend (TypeScript, Tailwind)
  api/      NestJS backend (TypeScript, Prisma + PostgreSQL)
packages/
  shared/   Role/permission matrix and domain enums shared by web and api
```

`apps/api/src` is organized by domain, matching the architecture doc's core services: `auth`, `users`, `kyc`, `wallet`, `trading`, `admin`, `support`, plus `prisma` for the database layer and `common` for cross-cutting guards/decorators (RBAC).

## Quick start / stop

Double-click `start-sahara.bat` (repo root) to start the local database, API, and web app in one
go -- opens two console windows (API, Web) you can watch, waits for each service before starting
the next. Double-click `stop-sahara.bat` to stop all three, database included. Both are plain
`.bat` files, nothing to install or configure.

Uses `ping -n N 127.0.0.1 >nul` rather than `timeout` for the between-step waits -- `timeout.exe`
throws "Input redirection is not supported" and exits immediately when it isn't given a real
interactive console (happens in some automation/remote-exec contexts, and can also happen if
something earlier in PATH shadows the Windows one), `ping` doesn't have that requirement. Both
scripts were run end-to-end against a real cold start and a real stop while testing, not just
written and assumed to work.

## Prerequisites

- Node.js 22+
- PostgreSQL 18, installed natively (Windows service `postgresql-x64-18`, auto-starts with the OS). No Docker needed.

## First-time setup

```bash
npm install                 # installs all workspaces, builds packages/shared automatically
```

Create the database and a dedicated role (once, via `psql` as the `postgres` superuser):

```sql
CREATE ROLE sahara LOGIN PASSWORD 'sahara_dev_password' CREATEDB; -- CREATEDB needed for prisma migrate's shadow database
CREATE DATABASE sahara_wallet OWNER sahara;
```

```bash
cd apps/api
cp .env.example .env        # DATABASE_URL already matches the role/db above -- just set JWT_SECRET
npx prisma migrate dev --name init   # creates the schema + migration history
npx prisma db seed          # creates staff + retail test accounts -- prints emails/passwords, read the output
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

A real Postgres install means `prisma migrate dev` works properly (shadow database, full migration history) instead of the `db push`-only workaround earlier revisions of this project needed. It also means the database survives independently of this repo -- no per-project start/stop step, Postgres just runs as a background Windows service.

## Running

```bash
npm run dev:api    # NestJS on :3000
npm run dev:web    # Next.js on :3000 by default -- change the port if running both
```

## Auth

- `POST /auth/register` `{ email, password, fullName? }` -- creates a retail `User`, returns `{ accessToken }`. Password must be 10+ characters.
- `POST /auth/login` `{ email, password }` -- retail user login, returns `{ accessToken }`.
- `POST /auth/staff-login` `{ email, password }` -- staff login against `StaffAccount`, returns `{ accessToken }`. No self-serve staff signup -- accounts are created directly (see seed script) until the role-management flow from the design doc's section 6.10 is built.
- `GET /auth/whoami` (requires `Authorization: Bearer <token>`) -- returns `{ id, role, kind }` decoded from the token.
- `GET /auth/super-admin-only` -- example of a route gated with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.SuperAdmin)`. Returns 403 for anyone without that role, 401 with no/invalid token.
- `npx prisma db seed` (from `apps/api`) creates every test account below. Idempotent -- safe to rerun, skips anything that already exists. Dev-only, rotate/delete before anything production-like. Log in at `/login`; staff accounts need the "Sign in as staff" checkbox checked.

  **Staff** (one per role in the permission matrix):

  | Email | Role | Password |
  |---|---|---|
  | `admin@sahara.dev` | Super admin | `change-me-immediately` (`SEED_SUPER_ADMIN_EMAIL`/`_PASSWORD`) |
  | `kyc@sahara.dev` | KYC officer | `change-me-immediately` (`SEED_KYC_OFFICER_EMAIL`/`_PASSWORD`) |
  | `support@sahara.dev` | Support agent | `staffpass123` |
  | `finance@sahara.dev` | Finance manager | `staffpass123` |
  | `listings@sahara.dev` | Listing admin | `staffpass123` |
  | `auditor@sahara.dev` | Auditor | `staffpass123` |

  **Retail** (password `testpass123` for all, covers every dashboard/KYC state):

  | Email | State |
  |---|---|
  | `verified@sahara.dev` | KYC approved, wallet with a $500 balance |
  | `pending@sahara.dev` | KYC submitted, sitting in the officer queue |
  | `rejected@sahara.dev` | KYC rejected, with a reason, can resubmit |
  | `unverified@sahara.dev` | Brand new, hasn't started KYC |
- CORS is open to `CORS_ORIGIN` (comma-separated, defaults to `http://localhost:3001`) via `app.enableCors()` in `main.ts`. Without this, browser requests from the web app fail with a generic network error, not a proper 4xx -- if that symptom shows up again after adding a new frontend origin, check this first.

Staff MFA (flagged as mandatory in the design doc) isn't implemented yet -- `mfaEnabled` exists on `StaffAccount` but nothing checks it.

## KYC and wallet

The onboarding chain from the design doc's section 6.1 is wired end to end: submit → officer review → approve/reject → wallet provisioned on approval only.

- `POST /kyc/submit` -- **multipart/form-data**, not JSON: fields `idType` (`passport`/`national_id`/`drivers_license`), `idNumber`, `country`, plus file(s) `documentFront` (always required) and `documentBack` (required unless `idType` is `passport` -- a passport only needs its detail page, national ID and driver's license need both sides). 400 if a required file is missing, 400 if you already have an open case. Files are validated by mime type (jpeg/png/webp/pdf) and capped at 8MB each.
- `GET /kyc/my-status` -- returns the caller's `kycTier` and latest case (including `documentPaths`).
- `GET /kyc/queue` (`KycOfficer` or `SuperAdmin`) -- pending cases, oldest first, with the applicant's basic info.
- `GET /kyc/:id/document/:index` -- streams back an uploaded document. Gated to the KYC officer/super admin reviewing it or the user who submitted it -- 403 for anyone else, 404 for a bad index.
- `POST /kyc/:id/approve` (`KycOfficer` only) -- approves the case, upgrades the user to `TIER_1_VERIFIED`, and provisions their `Wallet` (0 balance). Only works on a case still pending review -- 400 otherwise (already decided, or doesn't exist).
- `POST /kyc/:id/reject` `{ reason }` (`KycOfficer` only) -- rejects the case, no wallet is created.
- `GET /wallet/me` (any authenticated retail user) -- returns the caller's wallet, or 404 if KYC hasn't been approved yet.
- `POST /wallet/deposit` `{ amountUsdc }` -- **dev-only mock**, instantly settles a simulated fiat deposit and credits the balance. There is no real payment provider (Flutterwave/Paystack) wired up -- see design doc section 6.2 for the real flow (pending → provider webhook → settled). Don't build on top of this without replacing it; it exists so the wallet balance isn't permanently stuck at 0 during development.
- `GET /wallet/ledger` -- the caller's ledger entries, newest first, each with `balanceAfter` for an audit trail.

Every KYC decision writes an `AuditLogEntry` (`kyc.approve`/`kyc.reject`, actor = reviewing officer). Uploaded documents are written to local disk at `apps/api/uploads/kyc/<caseId>/` (memory storage in multer, written to disk in `KycService.saveDocuments`, not committed to git -- see `.gitignore`) -- this is dev-only local storage, not S3 or any real object store, and there's still no real KYC vendor (Smile ID) integration verifying the documents. Wallet provisioning logic lives in `WalletService.provisionWallet()` (`apps/api/src/wallet/wallet.service.ts`), called from `KycService`, not duplicated. Balance changes always go through `WalletService.credit()`, which does a DB-level atomic increment (not read-modify-write) plus a ledger entry in the same transaction -- route any future money-in flow (crypto deposits, sell proceeds) through this method rather than touching `usdcBalance` directly.

## Buy/sell, custody (Circle), send & receive

Product decisions (2026-07-09): **Ethereum + Solana** for chain support, **Circle Developer-Controlled Wallets** for custody (Circle manages keys via MPC, users never see a seed phrase). Circle covers USDC custody and multi-chain send/receive -- it does **not** cover the other tokenized assets (buy/sell of those stays on the listing approach below, unrelated to Circle).

**Buy/sell** (`trading` module, live and working, no Circle needed):
- `GET /trading/assets` -- live listings *with* `price`, `changePercent24h`, `sparkline` (24 points), `live` (boolean). Pricing comes from `PriceService` (`apps/api/src/trading/price.service.ts`): assets with a `coingeckoId` set get real-time data from CoinGecko's free public API (`live: true`), everything else falls back to the deterministic mock price from `mockPriceFor()` in `mock-price.ts` (`live: false`) -- seeded purely by symbol so a mock asset always shows the same numbers. **Either way, orders settle against these same numbers**, so display and execution never drift.
  - CoinGecko responses are cached in-memory for 30s (shared across all callers) to stay well under the free-tier rate limit. `sparkline_in_7d` (an ~168-point 7-day series) is sliced to its last 24 points for a real last-24h shape.
  - **Environments that only allow outbound HTTPS through a local proxy** (this dev sandbox included) need `HTTPS_PROXY`/`HTTP_PROXY` set -- Node's native `fetch` does not read those env vars itself, unlike curl, so `PriceService` explicitly routes through an `undici.ProxyAgent` when one of those vars is present. If CoinGecko calls silently fall back to mock everywhere, check the API logs for a `PriceService` warning first.
  - Staff opt an asset into live pricing by setting `coingeckoId` (e.g. `ethereum`, `solana`, `ripple`) when drafting a listing (`/staff/listings`) -- leave it blank for mock/placeholder pricing. `/markets` and `/markets/[id]` show a `Live`/`Mock` badge per asset so this is never ambiguous to a user.
- `POST /trading/orders` `{ assetId, side: "BUY"|"SELL", amount }` -- for `BUY`, `amount` is USDC to spend (must be ≥ the asset's `minOrderUsdc`); for `SELL`, `amount` is units of the asset to sell (must not exceed your held position). Debits/credits `Wallet.usdcBalance` through the existing `WalletService.credit`/`debit`, upserts `AssetPosition`, writes an `Order` row with status `SETTLED` (or `REJECTED` with a reason if the debit fails). Verified end-to-end via curl: buy, sell, insufficient-balance, insufficient-position, and below-minimum-order all return the right result.
- `GET /trading/orders/mine`, `GET /trading/positions/mine` -- caller's own order history and current (non-zero) holdings.
- Frontend: `/markets` (list, matches the screenshot-driven design brief -- symbol, live/mock badge, sparkline, colored price pill) → `/markets/[id]` (detail + buy form + sell form if holding a position).
- Seeded roster (`prisma/seed.ts`, idempotent): `ETH`, `SOL`, `XRP`, `XLM`, `ONDO` all live via CoinGecko; `KASA` stays mock on purpose -- it's a design-doc placeholder for a future tokenized Ghana Stock Exchange asset that doesn't correspond to any real, API-tracked instrument yet. xStocks (tokenized US equities) and `ARKX` (a real ETF) aren't seeded -- they'd need a stock-market data API (Alpha Vantage/Finnhub/Twelve Data etc.), which needs a signup + key, unlike CoinGecko's crypto data.

**Circle custody** (`circle` module) -- live and working:
- `CircleService` (`apps/api/src/circle/circle.service.ts`) wraps `@circle-fin/developer-controlled-wallets`: `createWalletSetForUser`, `createWalletsForSet` (one wallet per chain, `ETH-SEPOLIA` + `SOL-DEVNET` for now -- swap to `ETH`/`SOL` for mainnet, `accountType: 'EOA'` -- `'SCA'` throws `Error155507` on Solana, SCA is EVM-only), `getWalletBalances`, `createTransfer`. `isConfigured()` requires both `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` set in `apps/api/.env`.
- **Circle needs two secrets, not one**: an API key from the Circle console, and an Entity Secret -- generated locally and registered with Circle once via the SDK's `registerEntitySecretCiphertext()` (a one-time, non-reversible step; Circle returns a recovery file, saved at `apps/api/circle-recovery-file.dat`, gitignored -- store it somewhere safe outside the repo too). Both are set.
- Schema: `CircleWallet` model (`apps/api/prisma/schema.prisma`) -- one row per chain per user, holding Circle's wallet id + on-chain address. `Wallet.circleWalletSetId` links to the Circle wallet set.
- `WalletService.provisionCircleWallets(userId)` is called from `KycService.approve()` right after the internal `Wallet` row is provisioned -- creates the user's real Circle wallet set + one wallet per chain. Idempotent (no-ops if `circleWalletSetId` is already set), no-ops silently if Circle isn't configured, and swallows/logs errors rather than failing KYC approval -- Circle being down should never block a KYC decision.
- `GET /wallet/chains` -- `{ configured, chainWallets }` for the send/receive UI, verified via curl and a real browser check to return genuine Circle-issued addresses after approval.
- Frontend: `/transfer` -- shows real receive addresses and an enabled send form once Circle wallets are provisioned; falls back to an honest "not connected yet" disabled state if Circle isn't configured or provisioning hasn't run yet (no fake addresses, ever).

## Support, wallet oversight, asset listings, audit log

One functional slice per remaining staff role -- not the full flow from the design doc for any of them, but each role has something real to do instead of just a login.

**Support** (`support` module) -- any retail user can open a ticket, `SupportAgent`/`SuperAdmin` work the queue:
- `POST /support/tickets` `{ category, description, transactionRef? }` -- category is one of `deposit_issue`/`withdrawal_issue`/`kyc_question`/`funds_missing`/`account_access`/`other`. `funds_missing` and `account_access` auto-escalate to `HIGH` priority (`priorityForCategory` in the DTO file), everything else is `NORMAL`.
- `GET /support/tickets/mine` -- caller's own tickets.
- `GET /support/tickets` (`SupportAgent`/`SuperAdmin`) -- open queue, high priority first.
- `POST /support/tickets/:id/resolve` `{ resolutionNote }` -- resolves and assigns to whoever resolved it in one step (no separate "claim" UI, though `POST /support/tickets/:id/claim` exists on the API if you want to build one later). Writes an audit log entry.

**Wallet oversight** (on the existing `wallet` module) -- `FinanceManager`/`SuperAdmin`:
- `GET /wallet/admin/all` -- every wallet with the owning user's email/tier.
- `POST /wallet/admin/:id/freeze` `{ reason }` / `POST /wallet/admin/:id/unfreeze` -- both write an audit log entry. Freezing actually blocks money movement -- `WalletService.credit()` already throws if `wallet.frozen` is true, so a frozen wallet's owner gets a 403 on their next deposit attempt.

**Asset listings** (`trading` module) -- maker-checker across two roles, matching the design doc's section 6.9:
- `POST /trading/assets` (`ListingAdmin`/`SuperAdmin`) -- creates a `DRAFT`.
- `POST /trading/assets/:id/submit` (`ListingAdmin`/`SuperAdmin`) -- `DRAFT` → `PENDING_APPROVAL`.
- `POST /trading/assets/:id/publish` (**`SuperAdmin` only**, verified: a listing admin publishing their own submission gets 403) -- `PENDING_APPROVAL` → `LIVE`, sets `approvedByStaffId`/`publishedAt`, writes an audit log entry.
- `GET /trading/assets/drafts` (`ListingAdmin`/`SuperAdmin`) -- drafts + pending.
- `GET /trading/assets` (any authenticated user) -- live listings only. No buy/sell flow yet -- this just makes listings visible, doesn't let anyone trade them.

**Audit log** (`admin` module) -- `Auditor`/`SuperAdmin`:
- `GET /admin/audit-log?limit=100` (max 500) -- every `AuditLogEntry` across the whole system (KYC decisions, wallet freezes, asset publishes, support resolutions), newest first. Read-only, no filtering yet beyond `limit`.

## Frontend UI

- Dark mode via `next-themes`, class-based (`@custom-variant dark` in `globals.css`), defaults to system preference, toggle button in the nav bar. Theme persists in `localStorage` automatically (next-themes' job, not custom code).
- Brand color palette (teal/gold/sand) in `globals.css` CSS variables, sampled from `LOGO.jpeg` (the camel-and-sun logo). Same file also serves as the favicon (`src/app/icon.jpg`) and the small nav-bar mark (`public/logo.jpg`).
- Small component library in `src/components/ui/` (`Button`, `Input`, `Card`, `Label`) built on `class-variance-authority` + a `cn()` helper (`src/lib/utils.ts`). `Button` has no `asChild` prop (no Radix Slot installed) -- for a link styled as a button, import `buttonVariants` and apply it directly to the `<Link>`, don't wrap a `Link` in a `Button`.
- **This has now actually been visually verified in a real browser**, not just curl. Next.js still won't run two dev servers against the same source directory, but a separate project directory pointed at a real (non-symlinked -- Turbopack doesn't reliably resolve `src` through a directory junction, treats it as outside its project root and 404s everything) copy of `src`/`public` works around that. Confirmed at 320px, 375px, and 1280px: no horizontal overflow, no clipped/overlapping elements, dark mode toggle switches correctly. See the mobile-responsive fixes below -- there *were* real bugs, now fixed.
- Pages: `/` (landing), `/register`, `/login` (staff-login checkbox), `/dashboard` (whoami, wallet balance or a KYC prompt, RBAC test button, "report an issue" link for retail users, and a role-tool card for every staff tool the logged-in role can access), `/kyc` (retail user KYC submission -- conditional file inputs based on ID type, status display), `/support` (retail "report an issue" + your own ticket history). Staff tools all live under `/staff/`: `kyc-queue` (approve/reject, shows uploaded documents inline), `support-queue` (resolve tickets with a note), `wallets` (freeze/unfreeze with balances), `listings` (create draft assets, submit for approval; super admins additionally see a publish button), `audit-log` (read-only activity feed). Every `/staff/*` page does its own client-side role check via `whoami()` and redirects to `/dashboard` if the role doesn't match -- this is UX only, the API's own `RolesGuard` is the real enforcement (403s verified for every one of these). All API calls go through `src/lib/api.ts`; add new endpoints there rather than calling `fetch` directly in a page.
- `dashboard/page.tsx` picks which staff tool cards to show via a small `ROLE_TOOLS` array (`{roles, icon, title, description, href}`) filtered against the logged-in user's role, rather than one hand-written conditional block per role -- add new staff tools there, not as a copy-pasted card.
- Login state is shared via `AuthContext` (`src/lib/auth-context.tsx`, `AuthProvider` wraps everything in `layout.tsx`) -- always call `useAuth().login()`/`.logout()` after a successful auth request, never call `saveToken`/`clearToken` from `lib/api.ts` directly from a page. (Bug history: the nav bar used to check `localStorage` once on mount and never again, so it stayed on "Log in" after an actual login -- Next.js doesn't remount the root layout on client-side navigation, so a one-time check in a layout-level component goes stale the moment auth state changes anywhere else. `getToken()` itself is still fine to call directly when you just need the current token value for a request header, e.g. in `useEffect` data-fetching -- the bug was specifically about UI state that needs to react to login/logout.)
- File uploads use `FormData`, not JSON -- `lib/api.ts`'s `request()` helper skips setting `Content-Type` when the body is a `FormData` instance so the browser can set the multipart boundary itself. Follow this pattern for any future upload, don't hand-set `Content-Type: multipart/form-data` (it'll be missing the boundary and silently fail).
- `Footer` (`src/components/footer.tsx`) is wired into `layout.tsx` next to `NavBar`, shown on every page: copyright line + links to `/about`, `/privacy`, `/terms`, `/contact`. All four are real pages with real content, not placeholders that go nowhere. `/privacy` and `/terms` render a `DraftNotice` banner (`src/components/draft-notice.tsx`) -- **the copy on those two is a structurally reasonable draft, not reviewed by legal counsel** -- don't ship them as-is, and don't remove the banner until they actually have been reviewed.
- `devIndicators: false` in `next.config.ts` turns off Next's built-in dev-mode inspector button (the small logo overlaid bottom-left on every page in `next dev`) -- it's Next's own UI, not app code, and doesn't appear in a production build, but was distracting during regular use. **Requires a dev server restart to take effect** -- `next.config.ts` is only read at server boot, not hot-reloaded like `src/`.
- Viewing an uploaded KYC document requires an authenticated request (they're ID documents -- not served from a public URL). `fetchKycDocumentUrl()` in `lib/api.ts` fetches with the bearer token and returns an object URL; callers must `URL.revokeObjectURL()` when done (see the cleanup effect in `/staff/kyc-queue`).

## Mobile/responsive fixes

User reported the UI broke on other screen sizes. It genuinely did -- confirmed with real bounding-box measurements at 320px/375px/1280px, not guessed:

- **Nav bar overlapped at phone widths.** At 320px the theme toggle button visibly overlapped the "SAHARA" wordmark by ~20px; at 375px it was a smaller but real overlap. Root cause: the nav had zero mobile adaptation, just the same fixed gaps and full "Create account" text at every width. Fixed in `nav-bar.tsx`: responsive padding (`px-4 sm:px-6`), responsive gaps (`gap-1.5 sm:gap-3`), the CTA button shows "Sign up" below the `sm` breakpoint and "Create account" above it, brand link gets `min-w-0`/`truncate` so it can't force overflow.
- **Asset listing form silently became 2 columns anyway on mobile, unequally sized.** This was the subtle one: the outer grid correctly switched to `grid-cols-1` below `sm`, but the `name`/`issuer`/submit-button children kept an unconditional `col-span-2`. Per the CSS Grid spec, a child spanning more columns than the explicit grid defines doesn't clamp -- it forces the grid to grow an *implicit* auto-sized column to satisfy the span. Result: two columns of 41px and 185px (content-sized, not the intended `1fr`/`2fr`), confirmed via `getComputedStyle(form).gridTemplateColumns`. Fixed by making every `col-span-2` into `col-span-1 sm:col-span-2` in `staff/listings/page.tsx`. **If you add another responsive grid with spanning children, make the spans responsive too, not just the column count** -- this bug is easy to reintroduce.
- General polish: standardized page padding to `px-4 sm:px-6` (was a flat `px-6` everywhere, tight at 320px), `Card` padding on the auth/KYC forms to `p-6 sm:p-8`, landing page vertical spacing to `py-16 sm:py-24`, KYC-queue document thumbnails to `flex-wrap`, and the evidence field grid to `grid-cols-1 sm:grid-cols-3`.
- Verified clean (zero elements exceeding viewport bounds, checked via a full DOM bounding-box scan, not just eyeballing) at 320px on: `/`, `/register`, `/login`, `/dashboard`, `/kyc`, `/support`, and all five `/staff/*` pages.
- **How this was actually tested**, since Next.js's per-directory dev-server lock normally blocks a second `next dev` instance: created a throwaway sibling project (`apps/web-preview`, deleted after) with its own `node_modules` (directory-junctioned back to `apps/web`, junctions are fine for `node_modules`) but a **real copy** (not a junction -- Turbopack won't resolve `src` through one, treats it as outside its project root and 404s every route) of `src`/`public`, given its own port and its own `package.json` name to dodge an npm workspace collision. Also had to temporarily add that port to `CORS_ORIGIN` and strip the `next/font/google` import (this sandbox can't reach `fonts.googleapis.com`, which hung every page load) -- both reverted after. If this needs doing again, budget for these gotchas rather than rediscovering them.

## Notes for whoever picks this up

- The ledger schema (`apps/api/prisma/schema.prisma`) is a first pass covering every flow in the design doc's section 6 (deposits, withdrawals, orders, KYC cases, support tickets, audit log). It is intentionally single-entry per transaction, not full double-entry bookkeeping -- revisit before real money moves through it.
- `packages/shared` has no runtime dependencies on either app; it's built to `dist/` via `npm run build:shared` and consumed as a normal workspace package. Re-run that build after changing anything in `packages/shared/src`.
- `RolesGuard` (`apps/api/src/common/guards/roles.guard.ts`) reads `request.user.role`, populated by `JwtStrategy` once a request carries a valid bearer token -- always pair it with `JwtAuthGuard` (see the Auth section above), it does nothing on its own.
- Prisma is pinned to the 6.x line deliberately. 7.x ships an ESM-only client that requires driver adapters and breaks NestJS's default CommonJS build -- don't upgrade without doing that migration deliberately.
- **Database history:** local dev originally ran on `npx prisma dev` (an experimental, zero-install PGlite-backed server bundled with the Prisma CLI). It worked but was unreliable -- state didn't survive reboots cleanly, and it periodically reported itself running while every query failed with "Can't reach database server," needing a manual stale-lock-file cleanup under `%LOCALAPPDATA%\prisma-dev-nodejs\`. The project has since moved to a real native PostgreSQL 18 install (see Prerequisites/First-time setup above), which doesn't have either problem and also unlocked switching from `prisma db push` to proper `prisma migrate dev` migration history. If you ever see references to `prisma dev` elsewhere (old commits, this note), they're describing that earlier phase -- not the current setup.
- If the API can't reach the database now, it's a normal Postgres troubleshooting question: confirm the `postgresql-x64-18` Windows service is `Running` (Services, or `sc query postgresql-x64-18`), confirm port 5432 is listening (`netstat -ano | findstr :5432`), and confirm `apps/api/.env`'s `DATABASE_URL` matches the `sahara` role/`sahara_wallet` database created during setup.
