// Generate a QR, upload to 0x0.st, and send via Twilio WhatsApp
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

async function upload0x0(buffer, filename) {
  const form = new FormData();
  // Node's FormData requires a Blob for binary buffers
  const blob = new Blob([buffer], { type: 'image/png' });
  form.append('file', blob, filename);
  const res = await fetch('https://0x0.st', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed: ' + res.status);
  const text = (await res.text()).trim();
  return text;
}

(async () => {
  try {
    const recipient = 'whatsapp:+918847812836';
    const farmerId = 'qr-0x0-' + Date.now();
    const farmUrl = `https://himakrishi.vercel.app/farm/${farmerId}`;
    console.log('Generating QR for', farmUrl);
    const png = await QRCode.toBuffer(farmUrl, { errorCorrectionLevel: 'H', width: 300, type: 'png' });

    const filename = `qr-${Date.now()}.png`;
    console.log('Uploading to 0x0.st as', filename, '(public, temporary)');
    const publicUrl = await upload0x0(png, filename);
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
    console.error('Error sending QR via 0x0:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
