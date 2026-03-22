/**
 * call-client-list-dispute-messages.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=chettouhlotfi30@gmail.com"
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-client-list-dispute-messages.js K9E29iOi50853amb1gT6
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

  const disputeId = process.argv[2];
  const limit = Number(process.argv[3] || 50);

  if (!email || !pass) {
    console.error('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }
  if (!disputeId) {
    console.error("USAGE: node call-client-list-dispute-messages.js <disputeId> [limit]");
    process.exit(1);
  }

  console.log("=== Client test: listDisputeMessagesEU ===");
  console.log("email:", email);
  console.log("disputeId:", disputeId);
  console.log("limit:", limit);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const functions = getFunctions(app, "europe-west1");
  const fn = httpsCallable(functions, "listDisputeMessagesEU");
  const res = await fn({ disputeId, limit });

  console.log("OK:", JSON.stringify(res.data, null, 2));
}

main().catch((e) => {
  const code = e && e.code ? e.code : "";
  const message = e && e.message ? e.message : String(e);
  const details = e && e.details ? e.details : null;

  console.error("ERROR");
  if (code) console.error("code:", code);
  console.error("message:", message);
  if (details) console.error("details:", details);
  process.exit(1);
});
