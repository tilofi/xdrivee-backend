const admin = require("firebase-admin");

// غيّر المسار ده لملف الـ service account اللي عندك (أو استخدم default credentials إذا كنت في Cloud Functions)
const serviceAccount = require("./serviceAccountKey.json");  // ← غيّر المسار لو لازم

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function findDisputeCatalog() {
  console.log("🔍 جاري فحص كل الـ collections...\n");

  const collections = await db.listCollections();

  for (const col of collections) {
    console.log(`📁 Collection: ${col.id}`);
    
    const docsSnap = await col.get();
    
    for (const doc of docsSnap.docs) {
      const data = doc.data();
      if (!data) continue;

      const keys = Object.keys(data);
      console.log(`   📄 Document: ${doc.id} → fields: [${keys.join(", ")}]`);

      if (keys.includes("disputeCatalog") || keys.includes("dispute_catalog")) {
        console.log("\n✅ تم العثور عليه!");
        console.log(`   المسار الكامل: ${col.id}/${doc.id}`);
        console.log(`   محتوى disputeCatalog:`, Object.keys(data.disputeCatalog || {}));
        console.log(`   التفاصيل:`, JSON.stringify(data.disputeCatalog, null, 2));
      }
    }
  }

  console.log("\n=== انتهى الفحص ===");
}

findDisputeCatalog().catch(err => {
  console.error("خطأ:", err);
});