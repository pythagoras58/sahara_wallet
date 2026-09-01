# Sahara Wallet — setup for testers

You've been sent a zip of the Sahara Wallet codebase (no `node_modules`, no `.env` files —
those are excluded on purpose). This gets it running locally on your machine so you can try
it out and give feedback.

## 1. Install prerequisites

- **Node.js 22+** — https://nodejs.org
- **PostgreSQL** (18 recommended, but any recent version works) — https://www.postgresql.org/download/
  During install it'll ask you to set a password for the `postgres` superuser — remember it,
  you need it once in step 3.

## 2. Unzip and install dependencies

Unzip the project anywhere (any drive, any path — it doesn't matter). Then, from the project
root:

```bash
npm install
```

## 3. Create the database

Open `psql` (installed alongside PostgreSQL — on Windows, search Start Menu for "SQL Shell
(psql)") and run:

```sql
CREATE ROLE sahara LOGIN PASSWORD 'sahara_dev_password' CREATEDB;
CREATE DATABASE sahara_wallet OWNER sahara;
```

(`CREATEDB` is needed so Prisma can create its temporary shadow database when applying
migrations.)

## 4. Configure environment files

```bash
cd apps/api
cp .env.example .env
```

Open `apps/api/.env` and set `JWT_SECRET` to any random string — for example, generate one
with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that into `JWT_SECRET="..."`. Leave `DATABASE_URL` as-is (it already matches step 3).
Leave `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` blank unless you were given real values —
everything works fine without them, except the on-chain wallet address / send-receive
features, which will just show as "not connected yet" instead of erroring.

```bash
cd ../web
cp .env.example .env.local
cd ..
```

## 5. Set up the database schema and test accounts

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
cd ../..
```

The seed output prints a full list of test accounts (staff + retail users) and their
passwords — keep that output around, or check the "Auth" section of `README.md`, which has
the same table.

## 6. Run it

Double-click `start-sahara.bat` at the project root. It checks PostgreSQL is running, then
opens two windows: the API (`http://localhost:3000`) and the web app
(`http://localhost:3001`). Give it about 15 seconds, then open `http://localhost:3001` in
your browser.

To stop everything, run `stop-sahara.bat`.

## Notes

- This is a Windows-only setup (`start-sahara.bat`/`stop-sahara.bat` are batch files). If
  you're on Mac/Linux, run the two dev servers manually instead: `npm run dev:api` and
  `npm run dev:web` in separate terminals.
- Log in at `/login` — there's a "Sign in as staff" checkbox for staff accounts (KYC
  officer, support agent, finance manager, listing admin, auditor, super admin), unchecked
  for regular retail test users.
- Deposits ("Add funds") are simulated — no real payment provider is connected yet, so
  amounts credit instantly with no real money involved.
- Some market prices come from CoinGecko in real time; others are a clearly labeled
  placeholder price, not real market data.
