/**
 * xDrivee – Transition Trip Status (EU) — DRIVER
 *
 * Usage:
 *   node call-transition-trip-status.js <tripId> [toStatus]
 *
 * Env required:
 *   XD_DRIVER_EMAIL=driver_email
 *   DRIVER_PASS=driver_password
 *
 * Firebase client config:
 *   Either create local firebaseConfig.js / firebaseConfig.json
 *   OR set env vars:
 *     XD_API_KEY, XD_AUTH_DOMAIN, XD_PROJECT_ID, XD_APP_ID
 */

'use strict';

function requireEnv(k) {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${k}`);
  return String(v).trim();
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

function loadFirebaseConfig() {
  // 1) Try local config files first (optional)
  const candidates = [
    './firebaseConfig.js',
    './firebaseConfig.json',
    './firebaseConfig',
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const cfg = require(p);
      if (cfg && (cfg.apiKey || (cfg.default && cfg.default.apiKey))) {
        return cfg.default ? cfg.default : cfg;
      }
    } catch (_) {}
  }

  // 2) Fallback to env vars
  return {
    apiKey: requireEnv('XD_API_KEY'),
    authDomain: requireEnv('XD_AUTH_DOMAIN'),
    projectId: requireEnv('XD_PROJECT_ID'),
    appId: requireEnv('XD_APP_ID'),
  };
}

async function main() {
  const tripId = process.argv[2];
  const toStatus = (process.argv[3] || 'completed').trim();

  if (!tripId) {
    console.error('ERROR: tripId is required.');
    console.error('Usage: node call-transition-trip-status.js <tripId> [toStatus]');
    process.exit(1);
  }

  const driverEmail = requireEnv('XD_DRIVER_EMAIL');
  const driverPass = requireEnv('DRIVER_PASS');

  const firebaseConfig = loadFirebaseConfig();

  const { initializeApp } = require('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
  const { getFunctions, httpsCallable } = require('firebase/functions');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  console.log('=== xDrivee Transition Trip Status (EU) — DRIVER ===');
  console.log('EMAIL:', maskEmail(driverEmail));
  console.log('tripId:', tripId);
  console.log('toStatus:', toStatus);

  await signInWithEmailAndPassword(auth, driverEmail, driverPass);

  const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'transitionTripStatusEU');

  // Send multiple key names to maximize compatibility with your function signature.
  const payload = {
    tripId,
    toStatus,
    status: toStatus,
    newStatus: toStatus,
    targetStatus: toStatus,
  };

  const res = await fn(payload);

  console.log(JSON.stringify({ ok: true, result: res.data }, null, 2));
}

main().catch((e) => {
  const msg = e?.message || String(e);
  const code = e?.code || null;
  console.log(JSON.stringify({ ok: false, error: { code, message: msg } }, null, 2));
  process.exit(1);
});
