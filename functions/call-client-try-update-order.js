/**
 * call-client-try-update-order.js
 * Client-side test: tries to update order status directly (must FAIL by rules)
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=chettouhlotfi30@gmail.com"   (customer account OR any non-admin user)
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-client-try-update-order.js tdUTggk2Dmt1YBlPth38 pending
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

  const orderId = process.argv[2];
  const nextStatus = process.argv[3];

  if (!email || !pass) {
    console.error('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }
  if (!orderId || !nextStatus) {
    console.error("USAGE: node call-client-try-update-order.js <orderId> <nextStatus>");
    process.exit(1);
  }

  console.log("=== Client test: direct Firestore update (should FAIL) ===");
  console.log("email:", email);
  console.log("orderId:", orderId, "nextStatus:", nextStatus);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, pass);

  const db = getFirestore(app);
  const ref = doc(db, "orders", orderId);

  await updateDoc(ref, {
    status: nextStatus,
  });

  console.log("UNEXPECTED: update succeeded (this would mean rules are wrong).");
}

main().catch((e) => {
  console.log("EXPECTED FAIL:", e?.message || e);
  process.exit(0);
});