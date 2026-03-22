/**
 * xDrivee – Ride-Share Test (EU)
 * call-test-step2.js
 *
 * ENV (Windows CMD) — لازم:
 *   set "XD_EMAIL=customer_email"
 *   set "XD_PASS=customer_password"
 *   set "XD_DRIVER_EMAIL=driver_email"
 *   set "DRIVER_PASS=driver_password"
 */

'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
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

module.exports = { firebaseConfig };

function requireEnv(name) {
  return (process.env[name] && String(process.env[name]).trim())
    ? String(process.env[name]).trim()
    : '';
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

async function main() {
  const customerEmail = requireEnv('XD_EMAIL');
  const customerPass  = requireEnv('XD_PASS');

  const driverEmail = requireEnv('XD_DRIVER_EMAIL');
  const driverPass  = requireEnv('DRIVER_PASS');

  if (!customerEmail || !customerPass || !driverEmail || !driverPass) {
    console.error('❌ Missing ENV vars. In CMD set all of these then run again:');
    console.error('set "XD_EMAIL=..."');
    console.error('set "XD_PASS=..."');
    console.error('set "XD_DRIVER_EMAIL=..."');
    console.error('set "DRIVER_PASS=..."');
    process.exit(1);
  }

  console.log('=== xDrivee EU RideShare Test (step2) ===');
  console.log('Customer email:', maskEmail(customerEmail));
  console.log('Customer password (hidden)');
  console.log('Driver email:', maskEmail(driverEmail));
  console.log('Driver password (hidden)');

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

  const tripId = tripRes?.data?.tripId;
  if (!tripId) {
    console.error('❌ createTripEU did not return tripId');
    await logout(authC);
    process.exit(1);
  }
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

  // 4) DRIVER: transition statuses
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
    console.error(err?.code || err?.message || err);
    process.exit(1);
  });
}
