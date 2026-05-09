require('dotenv').config({ path: '.env.local' });
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const Twilio = require('twilio');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const supabaseService = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
// Support either TWILIO_PHONE_NUMBER or TWILIO_WHATSAPP_FROM (prefer whatsapp: format)
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || null; // legacy sender
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || null; // e.g. whatsapp:+1415...
const TWILIO_FROM = TWILIO_WHATSAPP_FROM || TWILIO_PHONE_NUMBER;
const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

const APP_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
async function generateAndSendQR(farmerId, toPhone) {
  if (!farmerId) throw new Error('farmerId is required');
  if (!toPhone) throw new Error('toPhone is required');

  try {
    // 1) Generate QR buffer
    const url = `${APP_BASE.replace(/\/$/, '')}/farm/${encodeURIComponent(farmerId)}`;
    const qrBuffer = await QRCode.toBuffer(url, { errorCorrectionLevel: 'H', width: 300, type: 'png' });

    // 2) Try upload to Supabase Storage (optional)
    let publicUrl = null;
    if (supabase || supabaseService) {
      try {
        const storageClient = supabaseService || supabase;
        const bucket = 'qrcodes';
        const filename = `${farmerId}.png`;
        const filePath = filename;

        // Ensure the bucket exists (create if missing). createBucket returns { data, error }
        try {
          const { data: cbData, error: cbError } = await storageClient.storage.createBucket(bucket, { public: true });
          if (cbError) {
            const msg = String(cbError.message || cbError || '');
            if (!/already exists/i.test(msg)) console.warn('createBucket warning:', msg);
          }
        } catch (cbErr) {
          const msg = String(cbErr && (cbErr.message || cbErr) || '');
          if (!/already exists/i.test(msg)) console.warn('createBucket threw (continuing):', msg);
        }

        const uploadResult = await storageClient.storage.from(bucket).upload(filePath, qrBuffer, {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000',
          upsert: true
        });
        if (uploadResult.error) {
          console.warn('Supabase storage upload error (continuing):', uploadResult.error.message);
        } else {
          // attempt to get public URL
          try {
            const maybe = storageClient.storage.from(bucket).getPublicUrl(filePath) || {};
            publicUrl = (maybe.data && maybe.data.publicUrl) || maybe.publicURL || null;
          } catch (e) {
            const res = storageClient.storage.from(bucket).getPublicUrl(filePath);
            publicUrl = res && res.publicURL ? res.publicURL : null;
          }
          if (!publicUrl) {
            publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeURIComponent(filePath)}`;
          }
        }
      } catch (err) {
        console.warn('Supabase upload failed (continuing):', err && err.message ? err.message : err);
      }
    }

    // 3) Send via Twilio: prefer to send media if publicUrl available, otherwise send a text with the farm URL
    if (!twilioClient) throw new Error('Twilio client not configured (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required)');
    if (!TWILIO_FROM) throw new Error('TWILIO_WHATSAPP_FROM or TWILIO_PHONE_NUMBER env var is required as the sender');

    // Normalize 'to' for WhatsApp
    let to = String(toPhone || '');
    if (!to.startsWith('whatsapp:') && to.startsWith('+')) to = `whatsapp:${to}`;
    if (!to.startsWith('whatsapp:') && /^[0-9]+$/.test(to)) to = `whatsapp:+${to}`;

    if (publicUrl) {
      try {
        const message = await twilioClient.messages.create({
          to,
          from: TWILIO_FROM,
          body: 'Your Hima Krishi listing is live! Buyers can scan this QR to see your farm. Share it proudly.',
          mediaUrl: [publicUrl]
        });
        return { publicUrl, sid: message.sid };
      } catch (err) {
        console.error('Twilio media send failed', err);
        throw new Error('Twilio media send failed: ' + (err && err.message ? err.message : String(err)));
      }
    }

    // fallback: send farm URL as plain text
    try {
      const message = await twilioClient.messages.create({
        to,
        from: TWILIO_FROM,
        body: `Your Hima Krishi listing is live! View it here: ${url}`
      });
      return { publicUrl: null, sid: message.sid, url };
    } catch (err) {
      console.error('Twilio text send failed', err);
      throw new Error('Twilio text send failed: ' + (err && err.message ? err.message : String(err)));
    }
  } catch (err) {
    console.error('generateAndSendQR failed', err);
    throw err;
  }
}

module.exports = generateAndSendQR;
