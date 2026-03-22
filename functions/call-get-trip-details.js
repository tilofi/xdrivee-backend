/**
 * xDrivee – Get Trip Details (EU)
 * call-get-trip-details.js
 *
 * Usage:
 *   node call-get-trip-details.js <TRIP_ID>
 *
 * ENV (CMD):
 *   set "XD_EMAIL=your_email"
 *   set "XD_PASS=your_password"
 */

'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const REGION = 'europe-west1';

const firebaseConfig = {
  apiKey: "AIzaSyDtsnYJAL4bkMpmhydj8X4nZMeRpqD3fG8",
  authDomain: "xdrivee-b0622.firebaseapp.com",
  databaseURL: "https://xdrivee-b0622-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "xdrivee-b0622",
  storageBucket: "xdrivee-b0622.firebasestorage.app",
  messagingSenderId: "730449205974",
  appId: "1:730449205974:web:fe9f1f370e4bf1ef448777"
};

function requireTripId() {
  const tripId = process.argv[2];
  if (!tripId || !String(tripId).trim()) {
    console.log('Usage: node call-get-trip-details.js <TRIP_ID>');
    process.exit(1);
  }
  return String(tripId).trim();
}

async function main() {
  const tripId = requireTripId();

  const email = process.env.XD_EMAIL;
  const pass = process.env.XD_PASS;

  if (!email || !pass) {
    console.error('❌ Missing env vars. Set:');
    console.error('   set "XD_EMAIL=your_email"');
    console.error('   set "XD_PASS=your_password"');
    process.exit(1);
  }

  console.log('=== xDrivee Get Trip Details (EU) ===');
  console.log('TRIP_ID:', tripId);
  console.log('EMAIL: (hidden)');

  const app = initializeApp(firebaseConfig);

  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const functions = getFunctions(app, REGION);
  const fn = httpsCallable(functions, 'getTripDetailsEU');

  const res = await fn({ tripId });

  console.log('✅ OK');
  console.log(JSON.stringify(res.data, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ ERROR');
    console.error(err?.code || err?.message || err);
    process.exit(1);
  });
}
