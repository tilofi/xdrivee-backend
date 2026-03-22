/**
 * xDrivee — call-cancel-trip.js (EU, ENV-based)
 * Region: europe-west1
 *
 * Windows CMD:
 *   set "XD_EMAIL=..."
 *   set "XD_PASS=..."
 *   node call-cancel-trip.js <tripId>
 *
 * Example:
 *   node call-cancel-trip.js FXHz3iUTD90kmU07AP5l
 */

'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const REGION = 'europe-west1';
const { firebaseConfig } = require('./call-test-step2');

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return email.slice(0, 2) + '***' + email.slice(at);
}

async function logout(auth) {
  try { await signOut(auth); } catch (_) {}
}

(async () => {
  try {
    const email = process.env.XD_EMAIL;
    const pass = process.env.XD_PASS;
    const tripId = process.argv[2] ? String(process.argv[2]).trim() : '';

    if (!email || !pass) {
      console.log('ERROR: set XD_EMAIL and XD_PASS first (Windows CMD).');
      process.exit(1);
    }
    if (!tripId) {
      console.log('ERROR: tripId is required. Usage: node call-cancel-trip.js <tripId>');
      process.exit(1);
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, email, pass);

    const uid = auth.currentUser.uid;

    const functions = getFunctions(app, REGION);
    const cancelTripEU = httpsCallable(functions, 'cancelTripEU');

    const res = await cancelTripEU({ tripId });

    console.log(JSON.stringify({
      ok: true,
      user: { uid, email: maskEmail(email) },
      tripId,
      result: res?.data || null
    }, null, 2));

    await logout(auth);
    process.exit(0);
  } catch (err) {
    console.log(JSON.stringify({
      ok: false,
      error: {
        message: err?.message || String(err),
        code: err?.code || null
      }
    }, null, 2));
    process.exit(1);
  }
})();
