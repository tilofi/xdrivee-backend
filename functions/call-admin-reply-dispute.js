/**
 * call-admin-reply-dispute.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=admin@example.com"
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-admin-reply-dispute.js K9E29iOi50853amb1gT6 "Admin reply"
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
  const text = process.argv[3];

  if (!email || !pass) {
    console.error('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }
  if (!disputeId || text === undefined) {
    console.error('USAGE: node call-admin-reply-dispute.js <disputeId> "text"');
    process.exit(1);
  }

  console.log("=== Client test: adminReplyDisputeEU ===");
  console.log("email:", email);
  console.log("disputeId:", disputeId);
  console.log("text:", text);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const functions = getFunctions(app, "europe-west1");
  const fn = httpsCallable(functions, "adminReplyDisputeEU");
  const res = await fn({ disputeId, text });

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
