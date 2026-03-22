
// xDrivee — call-debug-dispute-catalog.js (REST login)
const https = require("https");

const PROJECT_ID = "xdrivee-b0622";
const REGION = "europe-west1";
const FUNCTION_NAME = "debugDisputeCatalogEU";

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
          ...headers,
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (d) => (chunks += d));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(chunks || "{}");
          } catch (e) {
            return reject(new Error("NON_JSON_RESPONSE: " + chunks));
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function loginWithEmailPassword(email, password) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error('MISSING_ENV: set "FIREBASE_WEB_API_KEY=..."');

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await postJson(url, { email, password, returnSecureToken: true });

  if (res.status !== 200) throw new Error("LOGIN_FAILED: " + JSON.stringify(res.json));
  return res.json.idToken;
}

async function callCallable(idToken) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}`;
  return await postJson(url, { data: {} }, { Authorization: `Bearer ${idToken}` });
}

(async () => {
  const email = process.env.XD_EMAIL;
  const pass = process.env.XD_PASS;

  if (!email || !pass) {
    console.log('FAILED: Set env vars: set "XD_EMAIL=..." and set "XD_PASS=..."');
    process.exit(1);
  }

  try {
    const idToken = await loginWithEmailPassword(email, pass);
    const res = await callCallable(idToken);

    if (res.status !== 200) {
      console.log("❌ ERROR HTTP", res.status);
      console.log(JSON.stringify(res.json, null, 2));
      process.exit(1);
    }

    console.log("✅ OK");
    console.log(JSON.stringify(res.json, null, 2));
  } catch (e) {
    console.log("❌ ERROR");
    console.log(String(e.message || e));
    process.exit(1);
  }
})();