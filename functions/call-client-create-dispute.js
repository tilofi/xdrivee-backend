/**
 * call-client-create-dispute.js
 *
 * CMD:
 *   cd /d C:\Users\teach\xdrivee-backend\functions
 *   set "XD_EMAIL=chettouhlotfi30@gmail.com"
 *   set "XD_PASS=YOUR_PASSWORD"
 *   node call-client-create-dispute.js tdUTggk2Dmt1YBlPth38 "client dispute"
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");

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
  const reason = process.argv[3];

  if (!email || !pass) {
    console.error('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }
  if (!orderId || !reason) {
    console.error('USAGE: node call-client-create-dispute.js <orderId> "reason"');
    process.exit(1);
  }

  console.log("=== Client test: create dispute (should SUCCEED for opener) ===");
  console.log("email:", email);
  console.log("orderId:", orderId);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  const openedByUid = cred.user.uid;

  const db = getFirestore(app);
  const ref = await addDoc(collection(db, "disputes"), {
    orderId,
    openedByUid,
    reason,
    status: "open",
    createdAt: serverTimestamp(),
    statusUpdatedAt: serverTimestamp(),
  });

  console.log("OK: created dispute:", ref.id);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});