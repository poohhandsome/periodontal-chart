const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

function genCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[crypto.randomInt(0, chars.length)];
  return s;
}
function hashPw(pw, salt) {
  // scrypt → 32 bytes → hex
  return crypto.scryptSync(pw, salt, 32).toString('hex');
}

/**
 * createShare({ hn, password, perms?, ttlMinutes?, maxUses? })
 * returns { code, expiresAt, perms }
 */
exports.createShare = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  const ownerUid = context.auth?.uid;
  if (!ownerUid) throw new functions.https.HttpsError('unauthenticated', 'Sign-in required.');
  const { hn, password, perms = 'view', ttlMinutes = 1440, maxUses = 100 } = data || {};
  if (!hn || !password) throw new functions.https.HttpsError('invalid-argument', 'hn and password required');

  const code = genCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const pwHash = hashPw(password, salt);

  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + ttlMinutes * 60 * 1000);

  await db.collection('shares').doc(code).set({
    ownerUid, hn, perms,
    salt, pwHash,
    createdAt: now, expiresAt,
    active: true, uses: 0, maxUses
  });

  return { code, expiresAt: expiresAt.toMillis(), perms };
});

/**
 * redeemShare({ code, password })
 * returns { ownerUid, hn, perms }
 * Also writes: users/{ownerUid}/perioPatients/{hn}/viewers/{viewerUid}
 */
exports.redeemShare = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  const viewerUid = context.auth?.uid;
  if (!viewerUid) throw new functions.https.HttpsError('unauthenticated', 'Sign-in required.');
  const { code, password } = data || {};
  if (!code || !password) throw new functions.https.HttpsError('invalid-argument', 'code and password required');

  const shareSnap = await db.collection('shares').doc(code).get();
  if (!shareSnap.exists) throw new functions.https.HttpsError('not-found', 'Invalid code.');
  const s = shareSnap.data();

  if (!s.active) throw new functions.https.HttpsError('failed-precondition', 'Share is inactive.');
  if (s.expiresAt && s.expiresAt.toMillis() < Date.now())
    throw new functions.https.HttpsError('deadline-exceeded', 'Share expired.');
  if (s.maxUses && s.uses >= s.maxUses)
    throw new functions.https.HttpsError('resource-exhausted', 'Share exhausted.');

  const check = hashPw(password, s.salt);
  if (check !== s.pwHash) throw new functions.https.HttpsError('permission-denied', 'Wrong password.');

  const viewerRef = db
    .collection('users').doc(s.ownerUid)
    .collection('perioPatients').doc(s.hn)
    .collection('viewers').doc(viewerUid);

  await viewerRef.set({
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
    byShareCode: code,
    perms: s.perms
  }, { merge: true });

  await shareSnap.ref.update({ uses: admin.firestore.FieldValue.increment(1) });

  return { ownerUid: s.ownerUid, hn: s.hn, perms: s.perms };
});

/**
 * revokeShare({ code, revokeAllViewers? })
 */
exports.revokeShare = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  const ownerUid = context.auth?.uid;
  if (!ownerUid) throw new functions.https.HttpsError('unauthenticated', 'Sign-in required.');
  const { code, revokeAllViewers = false } = data || {};
  if (!code) throw new functions.https.HttpsError('invalid-argument', 'code required');

  const ref = db.collection('shares').doc(code);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };

  const s = snap.data();
  if (s.ownerUid !== ownerUid) throw new functions.https.HttpsError('permission-denied', 'Not owner.');
  await ref.update({ active: false });

  if (revokeAllViewers) {
    const viewers = await db
      .collection('users').doc(ownerUid)
      .collection('perioPatients').doc(s.hn)
      .collection('viewers')
      .where('byShareCode', '==', code).get();

    const batch = db.batch();
    viewers.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return { ok: true };
});
