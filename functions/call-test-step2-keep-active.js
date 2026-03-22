/**
 * xDrivee – Ride-Share Test (EU) — KEEP ACTIVE (Safe Output)
 * call-test-step2-keep-active.js
 *
 * ENV (CMD):
 *   set "XD_EMAIL=customer_email"
 *   set "XD_PASS=customer_password"
 *   set "XD_DRIVER_EMAIL=driver_email"
 *   set "DRIVER_PASS=driver_password"
 *
 * Run:
 *   node call-test-step2-keep-active.js
 */

'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const REGION = 'europe-west1';
const { firebaseConfig } = require('./call-test-step2');

function requireEnv(name, fallback = '') {
  return (process.env[name] && String(process.env[name]).trim())
    ? String(process.env[name]).trim()
    : fallback;
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return email.slice(0, 2) + '***' + email.slice(at);
}

async function login(app, email, pass) {
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);
  return auth;
}

async function logout(auth) {
  try { await signOut(auth); } catch (_) {}
}

function printFnError(step, err) {
  const out = {
    ok: false,
    step,
    error: {
      code: err?.code || null,
      message: err?.message || null,
      details: err?.customData || err?.details || null,
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

async function main() {
  const customerEmail = requireEnv('XD_EMAIL');
  const customerPass = requireEnv('XD_PASS');

  const driverEmail = requireEnv('XD_DRIVER_EMAIL');
  const driverPass = requireEnv('DRIVER_PASS');

  if (!customerEmail || !customerPass) {
    console.error('ERROR: Missing customer env vars: set XD_EMAIL=... and set XD_PASS=...');
    process.exit(1);
  }
  if (!driverEmail || !driverPass) {
    console.error('ERROR: Missing driver env vars: set XD_DRIVER_EMAIL=... and set DRIVER_PASS=...');
    process.exit(1);
  }

  console.log('=== xDrivee EU RideShare Test (step2 KEEP ACTIVE) ===');
  console.log('Customer email:', maskEmail(customerEmail));
  console.log('Driver email:', maskEmail(driverEmail));

  const app = initializeApp(firebaseConfig);
  const functions = getFunctions(app, REGION);

  const createTripEU = httpsCallable(functions, 'createTripEU');
  const submitTripBidEU = httpsCallable(functions, 'submitTripBidEU');
  const acceptTripBidEU = httpsCallable(functions, 'acceptTripBidEU');

  let authC = null;
  let authD = null;

  // 1) CUSTOMER: create trip
  try {
    authC = await login(app, customerEmail, customerPass);
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
    authC = null;

    // 2) DRIVER: submit bid
    authD = await login(app, driverEmail, driverPass);
    const driverUid = authD.currentUser.uid;
    console.log('DRIVER_UID:', driverUid);

    try {
      await submitTripBidEU({ tripId, bidAmount: 900 });
      console.log('BID_SUBMITTED: ok');
    } catch (err) {
      printFnError('DRIVER: submitTripBidEU', err);
      await logout(authD);
      return;
    }

    await logout(authD);
    authD = null;

    // 3) CUSTOMER: accept bid (KEEP ACTIVE: stop after assigned)
    authC = await login(app, customerEmail, customerPass);

    try {
      await acceptTripBidEU({ tripId, driverUid });
      console.log('BID_ACCEPTED: ok');
    } catch (err) {
      printFnError('CUSTOMER: acceptTripBidEU', err);
      await logout(authC);
      return;
    }

    await logout(authC);

    console.log('DONE (KEPT ACTIVE). tripId =', tripId);
  } finally {
    if (authC) await logout(authC);
    if (authD) await logout(authD);
  }
}

if (require.main === module) {
  main().catch((err) => {
    printFnError('MAIN', err);
    process.exit(1);
  });
}
