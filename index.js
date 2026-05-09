require('dotenv').config({ path: '.env.local' });
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');
const crypto = require('crypto');
const generateAndSendQR = require('./lib/generateAndSendQR');

function buildTwiml(messages) {
  // messages: [{ body: 'text', media: 'dataUrl' }, ...]
  let parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<Response>'];
  for (const m of messages) {
    parts.push('<Message>');
    if (m.body) parts.push(`<Body>${escapeXml(m.body)}</Body>`);
    if (m.media) parts.push(`<Media>${escapeXml(m.media)}</Media>`);
    parts.push('</Message>');
  }
  parts.push('</Response>');
  return parts.join('');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validateTwilioRequest(req, authToken) {
  try {
    const signatureHeader = req.get('X-Twilio-Signature') || req.get('x-twilio-signature');
    if (!signatureHeader) return false;

    // Build the absolute URL Twilio used (including host)
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // Build the string: url + sorted parameter name+value pairs
    const params = req.body && typeof req.body === 'object' ? req.body : {};
    const keys = Object.keys(params).sort();
    let data = url;
    for (const k of keys) {
      const v = params[k] === undefined || params[k] === null ? '' : params[k];
      data += String(k) + String(v);
    }

    // Compute expected signature (base64)
    const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');

    // Compare buffers safely (both are base64 encoded strings)
    const sigBuf = Buffer.from(signatureHeader, 'base64');
    const expBuf = Buffer.from(expected, 'base64');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (err) {
    console.error('Twilio validation error', err);
    return false;
  }
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
let supabase = null;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase env vars not set; running in mock mode (no DB insert).');
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const sessions = new Map(); // phone -> { step, data, updatedAt }
const qrStore = new Map(); // id -> { buffer, contentType }

// Session garbage collector: remove sessions older than 60 minutes
const SESSION_TTL_MS = 1000 * 60 * 60; // 60 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, sess] of sessions.entries()) {
    const updated = sess && sess.updatedAt ? sess.updatedAt : 0;
    if (now - updated > SESSION_TTL_MS) sessions.delete(phone);
  }
}, 1000 * 60 * 10); // run every 10 minutes

const BASE_URL = process.env.BASE_URL || null;

const questions = [
  'Welcome to Hima Krishi! What is your name?',
  'Which village are you from in Sikkim?',
  'What crop are you selling? (e.g. cardamom, ginger, turmeric)',
  'How many kg do you have available?',
  'When will it be ready to ship? (DD/MM/YYYY)'
];

const fields = ['name', 'village', 'crop', 'quantity_kg', 'ready_date'];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Hima Krishi Bot' });
});

app.post('/webhook', async (req, res) => {
  try {
    // Validate Twilio request if AUTH token provided
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const valid = validateTwilioRequest(req, authToken);
      if (!valid) {
        const xml = buildTwiml([{ body: 'Invalid Twilio signature.' }]);
        return res.status(403).type('text/xml').send(xml);
      }
    }
    const from = req.body.From || req.body.from;
    const body = String(req.body.Body || req.body.body || '').trim();
    if (!from) {
      return res.status(400).type('text').send('Missing From');
    }
    const phone = from.replace(/^whatsapp:/i, '');

    let session = sessions.get(phone);

    if (!session) {
      // start new session and ask first question
      session = { step: 0, data: {}, updatedAt: Date.now() };
      sessions.set(phone, session);
      const xml = buildTwiml([{ body: questions[0] }]);
      res.type('text/xml').send(xml);
      return;
    }

    // Save incoming message as answer to current step
    const step = session.step;
    if (step < questions.length) {
      // basic validations
      const field = fields[step];
      if (field === 'quantity_kg') {
        // parse integer quantity
        const n = parseInt(String(body).replace(/[^0-9-]/g, ''), 10);
        session.data[field] = Number.isInteger(n) ? n : null;
      } else {
        session.data[field] = body;
      }
      session.step = step + 1;
      session.updatedAt = Date.now();
    }

    if (session.step < questions.length) {
      const xml = buildTwiml([{ body: questions[session.step] }]);
      res.type('text/xml').send(xml);
      return;
    }

    // Completed all questions — save to Supabase
    const payload = {
      name: session.data.name || null,
      village: session.data.village || null,
      crop: session.data.crop || null,
      quantity_kg: session.data.quantity_kg || null,
      // convert DD/MM/YYYY to ISO if possible
      ready_date: parseDateDMY(session.data.ready_date),
      phone,
      created_at: new Date().toISOString()
    };

    let id = null;
    if (supabase) {
      const { data, error } = await supabase.from('farmers').insert([payload]).select();
      if (error) {
        console.error('Supabase insert error', error);
        const xml = buildTwiml([{ body: 'Sorry, there was an error saving your data. Please try again later.' }]);
        sessions.delete(phone);
        res.type('text/xml').send(xml);
        return;
      }
      const row = Array.isArray(data) && data[0] ? data[0] : data;
      id = row.id || row.ID || null;
    } else {
      // mock id when Supabase is not configured
      id = `local-${Date.now()}`;
      console.warn('Supabase not configured — skipping DB insert. Generated id:', id);
    }

    // Call helper to generate and send QR (uploads to Supabase storage and sends via Twilio)
    try {
      await generateAndSendQR(id, phone);
    } catch (err) {
      console.error('generateAndSendQR error', err && err.message ? err.message : err);
    }

    // Respond to Twilio webhook immediately
    const xml = buildTwiml([{ body: 'Thank you! Your farm listing was created. We have sent a QR to your WhatsApp.' }]);
    // Clear session
    sessions.delete(phone);
    res.type('text/xml').send(xml);
  } catch (err) {
    console.error('Webhook error', err);
    const xml = buildTwiml([{ body: 'An unexpected error occurred. Please try again later.' }]);
    res.type('text/xml').status(500).send(xml);
  }
});

function parseDateDMY(value) {
  if (!value) return null;
  // expect DD/MM/YYYY
  const m = String(value).trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  const yyyy = parseInt(m[3], 10);
  const d = new Date(Date.UTC(yyyy, mm, dd));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Serve QR images
app.get('/qr/:id', (req, res) => {
  const id = req.params.id;
  const item = qrStore.get(String(id));
  if (!item) return res.status(404).send('Not found');
  res.set('Content-Type', item.contentType);
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(item.buffer);
});

// Admin endpoint to register a QR buffer into the in-memory store
app.post('/admin/qr', (req, res) => {
  try {
    const { id, base64, contentType } = req.body || {};
    if (!id || !base64) return res.status(400).json({ error: 'id and base64 required' });
    const buffer = Buffer.from(base64, 'base64');
    qrStore.set(String(id), { buffer, contentType: contentType || 'image/png' });
    return res.json({ ok: true, id: String(id) });
  } catch (err) {
    console.error('admin/qr error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
