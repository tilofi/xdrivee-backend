/**
 * xDrivee - call-test-step2-acceptonly.js
 * createTripEU → submitTripBidEU → acceptTripBidEU
 * ثم يوقف (بدون أي transition)
 *
 * Uses: ./firebase.webconfig.json
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");
const fs = require("fs");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function promptLine(question) {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}

// hidden password prompt (no echo)
function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin;
    const buffer = [];

    const onData = (char) => {
      char = char + "";
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(buffer.join(""));
      } else if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      } else if (char === "\b" || char === "\u007f") {
        buffer.pop();
      } else {
        buffer.push(char);
      }
    };

    stdin.resume();
    stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

async function login(auth, email, pass) {
  if (!isValidEmail(email)) throw new Error("Invalid email format (auth/invalid-email).");
  if (!pass || String(pass).length < 1) throw new Error("Empty password.");
  await signInWithEmailAndPassword(auth, email.trim(), pass);
  const uid = auth.currentUser?.uid || "";
  if (!uid) throw new Error("Login succeeded but uid missing.");
  return uid;
}

function loadFirebaseWebConfig() {
  const path = "./firebase.webconfig.json";
  if (!fs.existsSync(path)) {
    throw new Error("Missing firebase.webconfig.json in functions folder.");
  }
  const cfg = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
    throw new Error("firebase.webconfig.json is missing required fields (apiKey/authDomain/projectId/appId).");
  }
  return cfg;
}

async function main() {
  const firebaseConfig = loadFirebaseWebConfig();

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const functions = getFunctions(app, "europe-west1");

  const createTripEU = httpsCallable(functions, "createTripEU");
  const submitTripBidEU = httpsCallable(functions, "submitTripBidEU");
  const acceptTripBidEU = httpsCallable(functions, "acceptTripBidEU");

  console.log("=== xDrivee EU RideShare Test (step2 - ACCEPT ONLY) ===");

  const CUSTOMER_EMAIL = await promptLine("Customer email: ");
  const CUSTOMER_PASS = await promptHidden("Customer password (hidden): ");
  const DRIVER_EMAIL = await promptLine("Driver email: ");
  const DRIVER_PASS = await promptHidden("Driver password (hidden): ");

  // 1) CUSTOMER: create trip
  const customerUid = await login(auth, CUSTOMER_EMAIL, CUSTOMER_PASS);
  console.log("CUSTOMER_UID:", customerUid);

  const tripRes = await createTripEU({
    origin: { lat: 36.7525, lng: 3.04197, placeName: "A", address: "A" },
    destination: { lat: 36.7631, lng: 3.0506, placeName: "B", address: "B" },
    distanceKm: 10,
    durationMin: 18,
    customerOffer: 900,
  });

  const tripId = tripRes?.data?.tripId;
  if (!tripId) throw new Error("createTripEU returned no tripId.");
  console.log("TRIP_CREATED:", tripId);

  await signOut(auth);

  // 2) DRIVER: submit bid
  const driverUid = await login(auth, DRIVER_EMAIL, DRIVER_PASS);
  console.log("DRIVER_UID:", driverUid);

  await submitTripBidEU({
    tripId,
    bidAmount: 950,
    etaSeconds: 240,
  });
  console.log("BID_SUBMITTED: ok");

  await signOut(auth);

  // 3) CUSTOMER: accept bid
  await login(auth, CUSTOMER_EMAIL, CUSTOMER_PASS);

  await acceptTripBidEU({
    tripId,
    driverUid,
  });
  console.log("BID_ACCEPTED: ok");

  await signOut(auth);

  console.log("STOPPED HERE ✅ (trip is now assigned).");
  console.log("USE THIS TRIP_ID IN STEP3:", tripId);

  // Exit cleanly to avoid hanging handles
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
