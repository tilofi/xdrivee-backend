/**
 * call-admin-reply-dispute-noauth.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   node call-admin-reply-dispute-noauth.js K9E29iOi50853amb1gT6 "Admin reply"
 */

const { initializeApp } = require("firebase/app");
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
  const disputeId = process.argv[2];
  const text = process.argv[3];

  if (!disputeId || text === undefined) {
    console.error('USAGE: node call-admin-reply-dispute-noauth.js <disputeId> "text"');
    process.exit(1);
  }

  console.log("=== Client test: adminReplyDisputeEU [no auth] ===");
  console.log("disputeId:", disputeId);
  console.log("text:", text);

  const app = initializeApp(firebaseConfig);
  const functions = getFunctions(app, "europe-west1");
  const fn = httpsCallable(functions, "adminReplyDisputeEU");
  const res = await fn({ disputeId, text });

  console.log("UNEXPECTED:", JSON.stringify(res.data, null, 2));
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
