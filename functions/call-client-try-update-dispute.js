/**
 * call-client-try-update-dispute.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=chettouhlotfi30@gmail.com"
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-client-try-update-dispute.js BCWcpMNbEkPnCplySPC3 closed
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, updateDoc } = require("firebase/firestore");

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
  const nextStatus = process.argv[3];

  if (!email || !pass) {
    console.error('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }
  if (!disputeId || !nextStatus) {
    console.error("USAGE: node call-client-try-update-dispute.js <disputeId> <nextStatus>");
    process.exit(1);
  }

  console.log("=== Client test: direct dispute update (should FAIL) ===");
  console.log("email:", email);
  console.log("disputeId:", disputeId, "nextStatus:", nextStatus);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const db = getFirestore(app);
  const ref = doc(db, "disputes", disputeId);

  await updateDoc(ref, { status: nextStatus });

  console.log("UNEXPECTED: update succeeded (rules would be wrong).");
}

main().catch((e) => {
  console.log("EXPECTED FAIL:", e?.message || e);
  process.exit(0);
});