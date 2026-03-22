/**
 * call-send-test-notification.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=maryemchettouh@gmail.com"
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-send-test-notification.js 9JT6mbwA1ARw5M7duv751y5H2pW2
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

const firebaseConfig = {
  apiKey: "AIzaSyDtsnYJAL4bkMpmhydj8X4nZMeRpqD3fG8",
  authDomain: "xdrivee-b0622.firebaseapp.com",
  projectId: "xdrivee-b0622",
  storageBucket: "xdrivee-b0622.appspot.com",
  messagingSenderId: "730449205974",
  appId: "1:730449205974:web:fe9f1f370e4bf1ef448777",
};

async function main() {
  const email = process.env.XD_EMAIL;
  const pass = process.env.XD_PASS;
  const userId = process.argv[2];

  if (!email || !pass) {
    console.error('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }
  if (!userId) {
    console.error("USAGE: node call-send-test-notification.js <userId>");
    process.exit(1);
  }

  console.log("=== xDrivee sendTestNotificationEU ===");
  console.log("userId:", userId);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const functions = getFunctions(app, "europe-west1");
  const fn = httpsCallable(functions, "sendTestNotificationEU");

  const res = await fn({
    userId,
    title: "xDrivee",
    body: "Hello from FCM (test)",
  });

  console.log("OK:", res.data);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});