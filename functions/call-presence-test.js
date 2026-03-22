/**
 * xDrivee - call-presence-test.js
 * الهدف: نجبر كتابة Presence في RTDB عبر updatePresenceEU
 * ثم نتحقق من ظهور driverPresence/{uid} في Realtime Database.
 */

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const { getFunctions, httpsCallable } = require("firebase/functions");

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

async function main() {
  // يقرأ إعدادات Firebase من الملف الذي أنشأته سابقًا
  const firebaseConfig = require("./firebase.webconfig.json");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // مهم: نفس Region عندك
  const functions = getFunctions(app, "europe-west1");
  const updatePresenceEU = httpsCallable(functions, "updatePresenceEU");

  console.log("=== xDrivee Presence Test (EU) ===");

  const DRIVER_EMAIL = await promptLine("Driver email: ");
  const DRIVER_PASS = await promptHidden("Driver password (hidden): ");

  if (!isValidEmail(DRIVER_EMAIL)) {
    throw new Error("Invalid email format (auth/invalid-email).");
  }

  await signInWithEmailAndPassword(auth, DRIVER_EMAIL.trim(), DRIVER_PASS);
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Login ok but uid missing.");

  console.log("DRIVER_UID:", uid);
  console.log("CALL updatePresenceEU ...");

  // Payload مرن (لو الدالة تستعمل بعض الحقول وتترك الباقي)
  const payload = {
    role: "driver",
    isOnline: true,
    online: true,
    status: "online",
    lat: 36.7525,
    lng: 3.04197,
    location: { lat: 36.7525, lng: 3.04197 },
    geo: { lat: 36.7525, lng: 3.04197 },
    heading: 0,
    speedKph: 0,
    ts: Date.now(),
  };

  const res = await updatePresenceEU(payload);
  console.log("RESULT:", res?.data || res);

  await signOut(auth);

  console.log("\nNOW CHECK RTDB PATH:");
  console.log("driverPresence/" + uid);
  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("FAILED ❌", e?.message || e);
  process.exit(1);
});
