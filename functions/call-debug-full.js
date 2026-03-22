console.log("جاري استدعاء debugPrintDisputeCatalogFull...");

const { httpsCallable } = require("firebase/functions");
const { initializeApp } = require("firebase/app");
const { getFunctions } = require("firebase/functions");

const firebaseConfig = {
  apiKey: "AIzaSyDtsnYJAL4bkMpmhydj8X4nZMeRpqD3fG8",
  authDomain: "xdrivee-b0622.firebaseapp.com",
  projectId: "xdrivee-b0622",
  storageBucket: "xdrivee-b0622.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",  // غيّر ده لو عندك
  appId: "YOUR_APP_ID"  // غيّر ده من Firebase Console
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

const debugCall = httpsCallable(functions, 'debugPrintDisputeCatalogFull');

debugCall({})
  .then((result) => {
    console.log("النتيجة:");
    console.log(JSON.stringify(result.data, null, 2));
  })
  .catch((error) => {
    console.error("خطأ:", error.message);
  });