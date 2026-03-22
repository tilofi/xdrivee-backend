/**
 * xDrivee — call-list-my-active-trips-driver.js
 * Region: europe-west1
 * Usage (Windows CMD):
 *   set "XD_EMAIL=..."
 *   set "XD_PASS=..."
 *   node call-list-my-active-trips-driver.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const { firebaseConfig } = require('./call-test-step2');

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return email.slice(0, 2) + '***' + email.slice(at);
}

(async () => {
  try {
    const email = process.env.XD_EMAIL;
    const pass = process.env.XD_PASS;

    if (!email || !pass) {
      console.log('ERROR: set XD_EMAIL and XD_PASS first (Windows CMD).');
      process.exit(1);
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;

    const functions = getFunctions(app, 'europe-west1');
    const listFn = httpsCallable(functions, 'listMyActiveTripsEU');

    // IMPORTANT: Cloud Function expects d.as (NOT roleHint)
    const res = await listFn({ as: 'driver', limit: 20 });
    const data = res?.data || {};

    const output = {
      ok: true,
      modeSent: { as: 'driver' },
      user: {
        uid,
        email: maskEmail(email),
      },
      result: data,
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: {
            message: err?.message || String(err),
            code: err?.code || null,
          },
        },
        null,
        2
      )
    );
    process.exit(1);
  }
})();
