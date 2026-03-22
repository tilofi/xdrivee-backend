/**
 * xDrivee – List My Trip History (EU)
 * Usage (CMD):
 *   set "XD_EMAIL=your_email"
 *   set "XD_PASS=your_password"
 *   set "XD_AS=customer"   (or driver)
 *   node call-list-my-trip-history.js
 *
 * Or (CMD) just:
 *   set "XD_AS=driver" && node call-list-my-trip-history.js
 */

'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return String(v).trim();
}

function loadFirebaseConfig() {
  // Tries common local config module/file names used by other call-*.js scripts
  const candidates = [
    './firebaseClientConfig',
    './firebase-client-config',
    './firebaseConfig',
    './firebase-config',
    './clientConfig',
    './client-config',
    './_clientConfig',
    './_firebaseConfig',
    './config/firebaseClientConfig',
    './config/firebaseConfig',
    './_config/firebaseClientConfig',
    './_config/firebaseConfig',

    './firebaseClientConfig.json',
    './firebase-config.json',
    './firebaseConfig.json',
    './clientConfig.json',
  ];

  for (const p of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const m = require(p);

      // module could export { firebaseConfig: {...} } or directly the config object
      if (m && m.firebaseConfig && m.firebaseConfig.apiKey) return m.firebaseConfig;
      if (m && m.apiKey && m.projectId) return m;
    } catch (_) {
      // continue
    }
  }

  // Fallback to env-based config (only if you already use env for config)
  const apiKey = process.env.XD_API_KEY;
  const authDomain = process.env.XD_AUTH_DOMAIN;
  const projectId = process.env.XD_PROJECT_ID || 'xdrivee-b0622';
  const appId = process.env.XD_APP_ID;

  if (apiKey && authDomain && projectId && appId) {
    return { apiKey, authDomain, projectId, appId };
  }

  throw new Error(
    'Firebase client config not found. ' +
      'This file expects an existing local firebase config module/json (like firebaseConfig.js) ' +
      'OR env vars: XD_API_KEY, XD_AUTH_DOMAIN, XD_PROJECT_ID, XD_APP_ID.'
  );
}

async function main() {
  const email = requireEnv('XD_EMAIL');
  const pass = requireEnv('XD_PASS');

  const as = (process.env.XD_AS || 'customer').toString().trim().toLowerCase() === 'driver'
    ? 'driver'
    : 'customer';

  const firebaseConfig = loadFirebaseConfig();

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // IMPORTANT: region for callable functions
  const functions = getFunctions(app, 'europe-west1');

  const listMyTripHistoryEU = httpsCallable(functions, 'listMyTripHistoryEU');

  console.log(`=== xDrivee List My Trip History (EU) — ${as.toUpperCase()} ===`);
  console.log('EMAIL:', email.replace(/^(.{2}).+(@.*)$/, '$1***$2'));

  await signInWithEmailAndPassword(auth, email, pass);

  const res = await listMyTripHistoryEU({ as, limit: 20 });

  const out = {
    ok: true,
    modeSent: { as },
    user: {
      uid: auth.currentUser ? auth.currentUser.uid : null,
      email: email.replace(/^(.{2}).+(@.*)$/, '$1***$2'),
    },
    result: res.data,
  };

  console.log(JSON.stringify(out, null, 2));

  await signOut(auth);
}

main().catch((e) => {
  const msg = (e && e.message) ? e.message : String(e);
  const code = (e && e.code) ? e.code : null;

  const out = {
    ok: false,
    error: { code, message: msg },
  };

  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 1;
});
