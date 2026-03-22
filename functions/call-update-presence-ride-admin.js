/**
 * call-update-presence-ride-admin.js
 * Run:
 *   cd C:\Users\teach\xdrivee-backend\functions
 *   set DRIVER_EMAIL=maryemchettouh@gmail.com
 *   set DRIVER_PASSWORD=PUT_PASSWORD_HERE
 *   node call-update-presence-ride-admin.js
 */

const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "xdrivee-b0622",
});

async function getWebApiKey() {
  // pulls from local firebase config if available (fallback to env)
  const envKey = process.env.FIREBASE_WEB_API_KEY;
  if (envKey) return envKey;

  // Try to read from .firebaserc / firebase.json is not enough; user can set env if needed
  throw new Error(
    "Missing FIREBASE_WEB_API_KEY. Set it in CMD: set FIREBASE_WEB_API_KEY=YOUR_KEY"
  );
}

async function signInAndGetIdToken(apiKey, email, password) {
  const url =
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
    apiKey;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Auth failed: ${res.status} ${JSON.stringify(json)}`
    );
  }
  return json.idToken;
}

async function callCallableUpdatePresence(idToken) {
  const url =
    "https://europe-west1-xdrivee-b0622.cloudfunctions.net/updatePresenceEU";

  const body = {
    data: {
      mode: "ride",
      lat: 37.238,
      lng: -76.509,
      heading: 0,
      speed: 0,
      accuracy: 10,
      clientSentAt: Date.now(),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  console.log("HTTP:", res.status);
  console.log(JSON.stringify(json, null, 2));
}

async function main() {
  console.log("=== call updatePresenceEU (ride) [admin script] ===");

  const email = process.env.DRIVER_EMAIL || "maryemchettouh@gmail.com";
  const password = process.env.DRIVER_PASSWORD;

  if (!password) {
    console.log("ERROR: Set DRIVER_PASSWORD first.");
    process.exit(1);
  }

  const apiKey = await getWebApiKey();
  const idToken = await signInAndGetIdToken(apiKey, email, password);

  await callCallableUpdatePresence(idToken);

  console.log("DONE.");
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
