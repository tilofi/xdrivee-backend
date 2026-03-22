/**
 * call-client-create-dispute-v2.js
 * Usage:
 *   node call-client-create-dispute-v2.js <orderId> <role> <category> <reasonCode> ["otherText"]
 *
 * Examples:
 *   node call-client-create-dispute-v2.js bqJLdvx2cnxQ6dVJZaLV customer delivery_delay C_DELAY_DRIVER
 *   node call-client-create-dispute-v2.js bqJLdvx2cnxQ6dVJZaLV customer other C_OTHER "تفاصيل إضافية هنا"
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const ORDER_ID = process.argv[2];
const ROLE = process.argv[3];
const CATEGORY = process.argv[4];
const REASON_CODE = process.argv[5];
const OTHER_TEXT = process.argv[6] || null;

if (!ORDER_ID || !ROLE || !CATEGORY || !REASON_CODE) {
  die('USAGE: node call-client-create-dispute-v2.js <orderId> <role> <category> <reasonCode> ["otherText"]');
}

const email = process.env.XD_EMAIL;
const pass = process.env.XD_PASS;

if (!email || !pass) {
  die('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
}

// Firebase web config is loaded from existing call-test-step2.js if you have it.
// Fallback: you can hardcode here if needed.
let firebaseConfig;
try {
  firebaseConfig = require("./call-test-step2.js").firebaseConfig;
} catch (e) {
  // Minimal fallback: try to load from call-test-step2.js default export style
  try {
    firebaseConfig = require("./call-test-step2.js");
  } catch (e2) {
    die("FAILED: Could not load firebaseConfig from call-test-step2.js. Put firebaseConfig export there or hardcode here.");
  }
}

(async () => {
  console.log("=== Client test: createDisputeEU (catalog reason) ===");
  console.log("email:", email);
  console.log("orderId:", ORDER_ID);
  console.log("role:", ROLE);
  console.log("category:", CATEGORY);
  console.log("reasonCode:", REASON_CODE);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const functions = getFunctions(app, "europe-west1");
  const fn = httpsCallable(functions, "createDisputeEU");

  const payload = {
    orderId: ORDER_ID,
    role: ROLE,
    category: CATEGORY,
    reasonCode: REASON_CODE,
  };

  if (OTHER_TEXT) payload.otherText = OTHER_TEXT;

  const res = await fn(payload);
  console.log("OK:", res.data);
  process.exit(0);
})().catch((err) => {
  const code = err && err.code ? err.code : "";
  const message = err && err.message ? err.message : String(err);
  const details = err && err.details ? err.details : null;

  console.error("❌ ERROR");
  if (code) console.error("code:", code);
  console.error("message:", message);
  if (details) console.error("details:", details);

  process.exit(1);
});