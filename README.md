# Builders Brew — Loyalty Platform

Staff-operated loyalty system for Builders Brew café (no customer-facing app).

## Roles

- **Staff (counter):** look up / register members by phone, log paid amount → points, redeem rewards verbally at the till
- **Admin (café owner):** rewards catalog, staff accounts, customer ledger adjustments, earning settings, reports. Sees the Messages page **read-only** — sent SMS, campaigns, and delivery stats — but cannot compose or send.
- **Platform owner:** everything Admin has, **plus** Test SMS + broadcast campaigns, and the only role that can create or edit `platform_owner` accounts. Managed by the service provider, not the café.

## Stack

- **Client:** React + Vite + Tailwind CSS v4 + React Query
- **Server:** Node.js + Express + MongoDB (Mongoose)
- **Auth:** JWT — staff/admin email + password

## Quick start

1. MongoDB on `mongodb://127.0.0.1:27017`
2. `cp server/.env.example server/.env` and set `JWT_SECRET` (see [Deployment](#deployment) for how to generate one)
3. Install & seed:

```bash
npm install
npm run install:all
npm run seed
npm run dev
```

- Landing: http://localhost:5173/  
- Staff login: http://localhost:5173/staff/login  
- Admin login: http://localhost:5173/admin/login

### Demo logins

| Role  | Credentials                      |
|-------|----------------------------------|
| Staff | `staff@buildersbrew.pk` / `Staff@123` |
| Admin (café owner) | `admin@buildersbrew.pk` / `Admin@123` |
| Platform owner | `rismyrimasha@gmail.com` / `Owner@123` |
| Demo member phone | `0712345678` (no login — staff opens profile) |

Admin and platform owner both sign in at `/admin/login`.

### Adding the platform owner to a live database

`npm run seed` wipes data — never run it on production. To add (or reset) the
platform-owner account on a live DB without touching anything else:

```bash
cd server
OWNER_EMAIL=you@example.com OWNER_PASSWORD='Strong@Pass1' OWNER_NAME='Ms. Rismy' npm run add:owner
```

## Deployment

The server **refuses to start** unless `JWT_SECRET` is a strong random value
(≥ 32 chars, not the example). Generate one:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copy `server/.env.example` → `server/.env` (or set the vars in your host's
dashboard) and fill in `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, and the
Notify.lk keys. Never commit `.env`.

### Option A — single origin (simplest)

Express serves the built client from the same origin as the API. No CORS, no
`VITE_API_URL`, no host rewrite rules.

```bash
npm run install:all
npm run build --prefix client
SERVE_CLIENT=true npm run start --prefix server
```

### Option B — split hosting (static client + API elsewhere)

1. **API** (Render / Railway / Fly): deploy `server/`, start command
   `npm run start`, set env vars. Leave `SERVE_CLIENT` unset.
2. **Client** (Netlify / Cloudflare Pages / Vercel): build `client/`, publish
   `client/dist`. Set `VITE_API_URL` to the full API base **including `/api`**,
   e.g. `https://api.buildersbrew.example/api`, then rebuild.
3. Set `CLIENT_ORIGIN` on the API to the client's URL (for CORS).
4. SPA deep-link fallback is already configured: `client/public/_redirects`
   (Netlify / Cloudflare) and `client/vercel.json` (Vercel). For any other
   static host, add a rewrite of all paths → `/index.html`.

## Counter flow

1. Ask customer for phone → **Look up**
2. If new → **Register** with name + phone
3. **Log order** with amount actually paid → points awarded
4. Show balance / progress toward next reward
5. **Redeem now** on a reward after verbal confirm (no QR / codes)

## Points & ledger

- Earn: `floor(amount_paid / 100) * points_per_100`
- Points only on amount actually paid
- Balance = earns + adjustments − completed redemptions (append-only ledger)

## Project structure

```
client/   Staff + Admin UI
server/   Express API, models, seed
```
