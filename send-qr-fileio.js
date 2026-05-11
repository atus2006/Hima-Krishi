// Generate a QR, upload to file.io, and send via Twilio WhatsApp
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const QRCode = require('qrcode');
const Twilio = require('twilio');

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_NUMBER;

if (!SID || !TOKEN || !FROM) {
  console.error('Missing Twilio credentials. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env.local');
  process.exit(1);
}

const client = Twilio(SID, TOKEN);

async function uploadFileIo(buffer, filename) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'image/png' });
  form.append('file', blob, filename);
  // file.io: returns JSON with 'link' on success
  const res = await fetch('https://file.io/?expires=14d', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed: ' + res.status);
  const j = await res.json();
  if (!j.success || !j.link) throw new Error('file.io upload error: ' + JSON.stringify(j));
  return j.link;
}

(async () => {
  try {
    const recipient = 'whatsapp:+918847812836';
    const farmerId = 'qr-fileio-' + Date.now();
    const BASE = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3001';
    const farmUrl = `${BASE.replace(/\/$/, '')}/farm/${farmerId}`;
    console.log('Generating QR for', farmUrl);
    const png = await QRCode.toBuffer(farmUrl, { errorCorrectionLevel: 'H', width: 300, type: 'png' });

    const filename = `qr-${Date.now()}.png`;
    console.log('Uploading to file.io as', filename, '(public link, expires in 14 days)');
    const publicUrl = await uploadFileIo(png, filename);
    console.log('Uploaded QR, public URL:', publicUrl);

    console.log('Sending WhatsApp message with media to', recipient);
    const msg = await client.messages.create({
      from: FROM,
      to: recipient,
      body: 'Your Hima Krishi QR — scan to view the farm',
      mediaUrl: [publicUrl]
    });
    console.log('Message sent, SID:', msg.sid);
    console.log('Public URL (temporary):', publicUrl);
    process.exit(0);
  } catch (err) {
    console.error('Error sending QR via file.io:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
