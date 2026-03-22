/**
 * xDrivee – Ride-Share Test (EU)
 * call-test-step3.js
 */

'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const REGION = 'europe-west1';
const firebaseConfig = require('./firebase.web.config.json');

function requireEnv(name, fallback = '') {
  return (process.env[name] && String(process.env[name]).trim())
    ? String(process.env[name]).trim()
    : fallback;
}

async function login(app, email, pass) {
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);
  return auth;
}

async function logout(auth) {
  try { await signOut(auth); } catch (_) {}
}

async function main() {
  const customerEmail = requireEnv('XD_EMAIL');
  const customerPass = requireEnv('XD_PASS');

  const driverEmail = requireEnv('XD_DRIVER_EMAIL', 'maryemchettouh@gmail.com');
  const driverPass = requireEnv('DRIVER_PASS');

  if (!customerEmail || !customerPass) {
    console.error('❌ Missing customer env vars: set XD_EMAIL=... and set XD_PASS=...');
    process.exit(1);
  }
  if (!driverPass) {
    console.error('❌ Missing driver env var: set DRIVER_PASS=...');
    process.exit(1);
  }

  console.log('=== xDrivee EU RideShare Test (step3) ===');
  console.log('Customer email:', customerEmail);
  console.log('Driver email:', driverEmail);

  const app = initializeApp(firebaseConfig);
  const functions = getFunctions(app, REGION);

  const createTripEU = httpsCallable(functions, 'createTripEU');
  const submitTripBidEU = httpsCallable(functions, 'submitTripBidEU');
  const acceptTripBidEU = httpsCallable(functions, 'acceptTripBidEU');
  const transitionTripStatusEU = httpsCallable(functions, 'transitionTripStatusEU');

  // 1) CUSTOMER: create trip
  const authC = await login(app, customerEmail, customerPass);
  const customerUid = authC.currentUser.uid;
  console.log('CUSTOMER_UID:', customerUid);

  const tripRes = await createTripEU({
    pickup: { label: 'A' },
    dropoff: { label: 'B' },
    distanceKm: 10,
    durationMin: 20,
    suggestedFare: 1000,
  });

  const tripId = tripRes.data.tripId;
  console.log('TRIP_CREATED:', tripId);

  await logout(authC);

  // 2) DRIVER: submit bid
  const authD = await login(app, driverEmail, driverPass);
  const driverUid = authD.currentUser.uid;
  console.log('DRIVER_UID:', driverUid);

  await submitTripBidEU({ tripId, bidAmount: 900 });
  console.log('BID_SUBMITTED: ok');

  await logout(authD);

  // 3) CUSTOMER: accept bid
  const authC2 = await login(app, customerEmail, customerPass);
  await acceptTripBidEU({ tripId, driverUid });
  console.log('BID_ACCEPTED: ok');

  await logout(authC2);

  // 4) DRIVER: transitions
  const authD2 = await login(app, driverEmail, driverPass);

  await transitionTripStatusEU({ tripId, nextStatus: 'arriving' });
  console.log('STATUS -> arriving: ok');

  await transitionTripStatusEU({ tripId, nextStatus: 'in_progress' });
  console.log('STATUS -> in_progress: ok');

  await transitionTripStatusEU({ tripId, nextStatus: 'completed' });
  console.log('STATUS -> completed: ok');

  await logout(authD2);

  console.log('DONE. tripId =', tripId);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ ERROR');
    console.error(err?.details || err?.code || err?.message || err);
    process.exit(1);
  });
}