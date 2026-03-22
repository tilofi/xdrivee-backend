/**
 * call-list-my-disputes-noauth.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   node call-list-my-disputes-noauth.js
 *   node call-list-my-disputes-noauth.js resolved 10
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
  const status = process.argv[2];
  const limitArg = process.argv[3];

  console.log("=== Client test: listMyDisputesEU [no auth] ===");
  if (status !== undefined) console.log("status:", status);
  if (limitArg !== undefined) console.log("limit:", limitArg);

  const app = initializeApp(firebaseConfig);
  const functions = getFunctions(app, "europe-west1");
  const fn = httpsCallable(functions, "listMyDisputesEU");
  const payload = {};
  if (status !== undefined) payload.status = status;
  if (limitArg !== undefined) payload.limit = Number(limitArg);

  const res = await fn(payload);
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
