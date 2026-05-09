# Hima Krishi — WhatsApp Bot Webhook

Express webhook that drives a simple WhatsApp conversation using Twilio and stores farmer records in Supabase. Generates a QR code linking to the farm page and returns it via TwiML.

Setup

1. Copy `.env.example` to `.env` and fill values for `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and Twilio credentials if needed).
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

Expose `POST /webhook` as your Twilio WhatsApp webhook URL. Twilio expects TwiML XML responses; the server replies with TwiML including a `Media` element containing a QR code image as a data URL.

Routes
- `POST /webhook` — Twilio webhook for incoming WhatsApp messages
- `GET /health` — health check

Database

The expected `farmers` table schema (for Supabase) is provided in `db/schema.sql` and looks like:

```
create table farmers (
	id uuid default gen_random_uuid() primary key,
	name text not null,
	village text not null,
	district text default 'East Sikkim',
	crop text not null,
	quantity_kg integer not null,
	ready_date date,
	phone text,
	certification_status text default 'Sikkim Organic Mission Certified',
	is_active boolean default true,
	created_at timestamptz default now()
);
```

Make sure row-level security and policies allow inserts from the service role or the anon key as appropriate — a sample set of policies is included in `db/schema.sql`.

Twilio & QR hosting

- Set `TWILIO_AUTH_TOKEN` in `.env` to enable Twilio request validation. The server will verify incoming webhook signatures and reject invalid requests.
- For Twilio to fetch QR images, set `BASE_URL` to a public URL (for example the `ngrok` HTTPS URL) so the server can return a media URL (`/qr/:id`). If `BASE_URL` is not set, the server will attempt to derive the base URL from the incoming request.
# Local web app (Next.js) and environment

To run the buyer portal and webhook together locally:

1) Copy and fill environment files:

```bash
cp .env.local.example .env.local
# then edit .env.local and add your SUPABASE and TWILIO values
```

2) Install dependencies:

```bash
npm install
```

3) Start the webhook server (used by Twilio):

```bash
npm start
```

4) Start the Next.js buyer portal (in a separate terminal):

```bash
npm run dev:web
```

For local Twilio testing, expose your webhook with ngrok (example):

```bash
npx ngrok http 3000
# paste the ngrok HTTPS URL into Twilio sandbox webhook settings
```

Render/Vercel

- `Render` start command: `node index.js` (webhook).
- Deploy Next.js app to Vercel and set `NEXT_PUBLIC_APP_URL` to your deployed URL.

# Hima-Krishi