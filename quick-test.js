// Quick end-to-end test: insert a test farmer to Supabase, send QR, then delete the test record
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const generateAndSendQR = require('./lib/generateAndSendQR');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase env vars missing in .env or .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  let insertedId = null;
  try {
    const test = {
      name: 'Quick Test Farmer',
      village: 'Ravangla',
      crop: 'TestCrop',
      quantity_kg: 1,
      ready_date: new Date().toISOString(),
      phone: '+918847812836'
    };
    console.log('Inserting test farmer...');
    const { data, error } = await supabase.from('farmers').insert([test]).select();
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    insertedId = row && (row.id || row.ID);
    console.log('Inserted test farmer with id', insertedId);

    // Call generateAndSendQR with the test farmer id and the joined recipient
    const recipient = '+918847812836';
    console.log('Calling generateAndSendQR for', insertedId, '->', recipient);
    const result = await generateAndSendQR(insertedId, recipient);
    console.log('generateAndSendQR result:', result);
    console.log('Test complete — cleaning up...');

    // Delete test farmer
    if (insertedId) {
      const { error: delErr } = await supabase.from('farmers').delete().eq('id', insertedId);
      if (delErr) console.warn('Cleanup delete error', delErr.message || delErr);
      else console.log('Deleted test farmer', insertedId);
    }
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err && err.message ? err.message : err);
    if (insertedId) {
      try {
        await supabase.from('farmers').delete().eq('id', insertedId);
        console.log('Deleted test farmer during cleanup', insertedId);
      } catch (e) {}
    }
    process.exit(1);
  }
})();
