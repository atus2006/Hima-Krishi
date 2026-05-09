// Send a plain WhatsApp text message via Twilio (fallback when Supabase bucket missing)
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const Twilio = require('twilio');

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;

if (!SID || !TOKEN || !FROM) {
  console.error('Missing Twilio credentials in env. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM');
  process.exit(1);
}

const client = Twilio(SID, TOKEN);

(async () => {
  try {
    const to = 'whatsapp:+918847812836';
    const body = 'Hima Krishi test message: your sandbox connection looks good.';
    console.log('Sending to', to, 'from', FROM);
    const msg = await client.messages.create({ from: FROM, to, body });
    console.log('Message sent, SID:', msg.sid);
    process.exit(0);
  } catch (err) {
    console.error('Send error:', err && err.message ? err.message : err);
    if (err && err.code) console.error('Twilio error code:', err.code);
    process.exit(1);
  }
})();
