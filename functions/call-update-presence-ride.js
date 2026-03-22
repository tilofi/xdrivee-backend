/**
 * call-update-presence-ride.js  (FULL FILE)
 * xDrivee (EU) — calls updatePresenceEU (callable) using Firebase Client SDK
 *
 * Windows CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=maryemchettouh@gmail.com"
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-update-presence-ride.js
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

// ✅ Your xDrivee Web App config (NOT "service account", NOT firebase-admin)
const firebaseConfig = {
  apiKey: "AIzaSyDtsnYJAL4bkMpmhydj8X4nZMeRpqD3fG8",
  authDomain: "xdrivee-b0622.firebaseapp.com",
  projectId: "xdrivee-b0622",
  storageBucket: "xdrivee-b0622.appspot.com",
  messagingSenderId: "730449205974",
  appId: "1:730449205974:web:fe9f1f370e4bf1ef448777",
};

async function main() {
  console.log("=== xDrivee call updatePresenceEU (ride) ===");

  const email = process.env.XD_EMAIL;
  const pass = process.env.XD_PASS;

  if (!email || !pass) {
    console.error('FAILED: Missing env vars. Set: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);

  // Auth
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);
  console.log("SIGNED_IN_AS:", email);

  // Functions (EU)
  const functions = getFunctions(app, "europe-west1");
  const updatePresenceEU = httpsCallable(functions, "updatePresenceEU");

  // Payload
  const payload = {
    lat: 37.146,
    lng: -76.509,
    mode: "driver",
    isOnline: true,
  };

  const res = await updatePresenceEU(payload);
  console.log("OK:", res.data);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
