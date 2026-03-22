/**
 * xDrivee — List Active Trips (EU)
 *
 * Usage (Windows CMD):
 *   set "XD_EMAIL=customer_email"
 *   set "XD_PASS=customer_password"
 *   set "XD_AS=customer"
 *   node call-list-active-trips.js
 *
 * Or as driver:
 *   set "XD_EMAIL=driver_email"
 *   set "XD_PASS=driver_password"
 *   set "XD_AS=driver"
 *   node call-list-active-trips.js
 *
 * Notes:
 * - Requires: ./firebase.web.config.json in the SAME folder as this script.
 * - Calls Cloud Function: listMyActiveTripsEU (callable) in europe-west1
 */

const fs = require('fs');
const path = require('path');

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) return null;
  return String(v).trim();
}

function loadWebConfig() {
  const p = path.join(__dirname, 'firebase.web.config.json'); // REQUIRED exact name
  if (!fs.existsSync(p)) {
    throw new Error("Cannot find module './firebase.web.config.json'");
  }
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function normalizeAs(as) {
  const v = (as || '').toLowerCase().trim();
  if (v !== 'customer' && v !== 'driver') return 'customer';
  return v;
}

async function main() {
  const email = requireEnv('XD_EMAIL');
  const pass = requireEnv('XD_PASS');
  const as = normalizeAs(requireEnv('XD_AS'));

  if (!email || !pass) {
    console.error('ERROR: Missing env vars. You must set XD_EMAIL and XD_PASS.');
    process.exit(1);
  }

  const webConfig = loadWebConfig();

  const app = initializeApp(webConfig);
  const auth = getAuth(app);

  // Sign in
  await signInWithEmailAndPassword(auth, email, pass);

  // EU region
  const functions = getFunctions(app, 'europe-west1');

  // IMPORTANT: this function name MUST exist (it does in your functions:list)
  const listMyActiveTripsEU = httpsCallable(functions, 'listMyActiveTripsEU');

  // Active statuses we care about
  const activeStatuses = ['created', 'bidding', 'assigned', 'arrived', 'started'];

  console.log('=== xDrivee List ACTIVE Trips (EU) ===');
  console.log('AS:', as);
  console.log('EMAIL:', email.replace(/(.{2}).+(@.+)/, '$1***$2'));

  const res = await listMyActiveTripsEU({
    as,
    statuses: activeStatuses,
    limit: 50,
  });

  const data = res?.data || {};
  console.log(JSON.stringify(
    {
      ok: true,
      user: {
        uid: auth.currentUser?.uid || null,
        email,
      },
      activeStatuses,
      result: data,
    },
    null,
    2
  ));
}

main().catch((e) => {
  // Firebase callable errors often come as objects with code/message
  const code = e?.code || null;
  const message = e?.message || String(e);

  // Print a clean single-line error like your other scripts
  if (code && typeof code === 'string') {
    // Examples: functions/not-found, functions/failed-precondition
    console.error('ERROR:', code.replace('functions/', ''));
    if (message) console.error(message);
  } else {
    console.error('ERROR:', message);
  }
  process.exit(1);
});
