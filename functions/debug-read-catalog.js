// debug-read-catalog.js
// Run: node debug-read-catalog.js

const admin = require("firebase-admin");

const PROJECT_ID = "xdrivee-b0622";

// Force project id for google-auth-library / firestore client
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || PROJECT_ID;
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || PROJECT_ID;

admin.initializeApp({
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const CONFIG_COLLECTION_CANDIDATES = ["appConfig", "app_config"];
const CATALOG_FIELD_CANDIDATES = [
  "disputeCatalog",
  "dispute_catalog",
  "disputeReasonCatalog",
];

function typeOfFirestoreValue(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  return typeof v; // object, string, number, boolean
}

async function main() {
  let source = null;
  let cfg = null;
  let catalogField = null;

  for (const collectionName of CONFIG_COLLECTION_CANDIDATES) {
    const snap = await db.collection(collectionName).doc("main").get();
    if (!snap.exists) continue;

    const data = snap.data() || {};
    for (const field of CATALOG_FIELD_CANDIDATES) {
      if (data[field] && typeof data[field] === "object") {
        source = `${collectionName}/main`;
        cfg = data;
        catalogField = field;
        break;
      }
    }

    if (cfg) break;
  }

  if (!cfg) {
    console.log("CONFIG_MISSING: could not resolve catalog from appConfig/main or app_config/main");
    process.exit(1);
  }

  const cat = cfg[catalogField];

  console.log("PROJECT_ID:", PROJECT_ID);
  console.log("CONFIG_SOURCE:", source);
  console.log("CATALOG_FIELD:", catalogField);
  console.log("catalog type:", typeOfFirestoreValue(cat));

  if (!cat || typeof cat !== "object") {
    console.log("catalog is missing or not an object.");
    process.exit(0);
  }

  for (const role of ["customer", "driver", "restaurant"]) {
    const roleMap = cat[role];
    console.log("\nROLE:", role, "type:", typeOfFirestoreValue(roleMap));

    if (!roleMap || typeof roleMap !== "object") continue;

    for (const categoryKey of Object.keys(roleMap)) {
      const v = roleMap[categoryKey];
      console.log("  -", categoryKey, "=>", typeOfFirestoreValue(v));

      if (Array.isArray(v)) {
        console.log("      length:", v.length);
        if (v.length > 0) console.log("      first[0]:", JSON.stringify(v[0]));
        for (let i = 0; i < Math.min(v.length, 5); i++) {
          const item = v[i] || {};
          const raw = item.code;
          console.log(`      item[${i}].code raw:`, JSON.stringify(raw));
          console.log(`      item[${i}].code trim:`, JSON.stringify(String(raw || "").trim()));
        }
      } else if (v && typeof v === "object") {
        const keys = Object.keys(v);
        console.log("      MAP keys:", keys.slice(0, 10));
      }
    }
  }

  // Direct test for your failing path:
  const role = "customer";
  const category = "delivery_delay";
  const code = "C_DELAY_DRIVER";

  const arrOrMap = cat?.[role]?.[category];
  console.log("\nTEST PATH:", `catalog.${role}.${category}`);
  console.log("TYPE:", typeOfFirestoreValue(arrOrMap));

  let found = null;
  if (Array.isArray(arrOrMap)) {
    found = arrOrMap.find(
      (x) => x && typeof x === "object" && String(x.code || "").trim() === code
    );
  }

  console.log("FOUND:", found ? JSON.stringify(found) : "NOT_FOUND");
}

main().catch((e) => {
  console.error("ERROR:", e && e.stack ? e.stack : e);
  process.exit(1);
});
