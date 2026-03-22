/**
 * Local onCall lifecycle test (EU) + prints CUSTOMER_UID / DRIVER_UID
 * Run: node call-test.js
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

const firebaseConfig = {
  apiKey: "AIzaSyDtsnYJAL4bkMpmhydj8X4nZMeRpqD3fG8",
  authDomain: "xdrivee-b0622.firebaseapp.com",
  databaseURL: "https://xdrivee-b0622-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "xdrivee-b0622",
  storageBucket: "xdrivee-b0622.firebasestorage.app",
  messagingSenderId: "730449205974",
  appId: "1:730449205974:web:fe9f1f370e4bf1ef448777",
};

const REGION = "europe-west1";

// EDIT ONLY THESE 4 LINES (DO NOT SHARE PASSWORDS HERE)
const EMAIL = "chettouhlotfi30@gmail.com";
const PASSWORD = "Lotfi1986@";
const DRIVER_EMAIL = "maryemchettouh@gmail.com";
const DRIVER_PASSWORD = "Lotfi1986@";

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const functions = getFunctions(app, REGION);

  const createTripEU = httpsCallable(functions, "createTripEU");
  const submitTripBidEU = httpsCallable(functions, "submitTripBidEU");
  const acceptTripBidEU = httpsCallable(functions, "acceptTripBidEU");

  // 1) CUSTOMER: login + print UID
  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  console.log("CUSTOMER_UID:", auth.currentUser.uid);

  // 2) CUSTOMER: create trip
  const created = await createTripEU({
    origin: { lat: 36.75, lng: 5.06, placeName: "A", address: "A" },
    destination: { lat: 36.78, lng: 5.1, placeName: "B", address: "B" },
    distanceKm: 10,
    durationMin: 20,
    customerOffer: 900,
  });
  const tripId = created.data.tripId;
  console.log("TRIP:", tripId);

  // 3) DRIVER: login + print UID
  await signOut(auth);
  await signInWithEmailAndPassword(auth, DRIVER_EMAIL, DRIVER_PASSWORD);
  console.log("DRIVER_UID:", auth.currentUser.uid);

  // 4) DRIVER: submit bid
  await submitTripBidEU({ tripId, bidAmount: 950, etaSeconds: 240 });
  console.log("BID: submitted");

  // 5) CUSTOMER: accept bid
  const driverUid = auth.currentUser.uid;
  await signOut(auth);
  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);

  await acceptTripBidEU({ tripId, driverUid });
  console.log("ACCEPT: ok");

  console.log("DONE");
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  if (e?.details) console.error("DETAILS:", e.details);
  process.exit(1);
});
