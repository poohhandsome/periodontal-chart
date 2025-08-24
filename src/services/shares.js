// src/services/shares.js  — Spark-plan sharing (no Cloud Functions)

import { db, auth } from './firebase';
import {
  doc, setDoc, getDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';

// ---------- crypto helpers (PBKDF2-SHA256) ----------
const enc = new TextEncoder();

function bytesToHex(u8) {
  return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomSaltBase64(len = 16) {
  const u8 = new Uint8Array(len);
  crypto.getRandomValues(u8);
  let s = '';
  u8.forEach(b => s += String.fromCharCode(b));
  return btoa(s);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
async function derivePwHash(password, saltB64, iterations = 150000) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

// ---------- code generator ----------
function genCode(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

/**
 * createShare (owner)
 * Writes:
 *  - /users/{ownerUid}/perioPatients/{hn}/shareSecret/current  (owner-only, stores code+pwHash)
 *  - /publicSalts/{code}                                      (public read salt)
 */
export async function createShare({ ownerUid, hn, password, ttlMinutes = 1440, perms = 'view' }) {
  if (!ownerUid) throw new Error('Owner UID required');
  if (!hn) throw new Error('Patient HN required');
  if (!password) throw new Error('Password required');

  const code = genCode(6);
  const salt = randomSaltBase64(16);
  const pwHash = await derivePwHash(password, salt);

  const nowMs = Date.now();
  const expiresAt = Timestamp.fromMillis(nowMs + ttlMinutes * 60 * 1000);

  // owner-only secret
  const secretRef = doc(db, 'users', ownerUid, 'perioPatients', hn, 'shareSecret', 'current');
  await setDoc(secretRef, {
  ownerUid,            // <-- add
  hn,                  // <-- add
  code,
  pwHash,
  perms,
  active: true,
  createdAt: serverTimestamp(),
  expiresAt
}, { merge: true });

  // public salt indexed by code
  const saltRef = doc(db, 'publicSalts', code);
  await setDoc(saltRef, {
    ownerUid,
    hn,
    salt,
    active: true,
    expiresAt
  });

  return { code, expiresAt: expiresAt.toMillis(), perms, salt };
}

/**
 * revokeShare (owner)
 * Disables new redemptions; optionally you can delete viewer grants manually.
 */
export async function revokeShare({ ownerUid, hn }) {
  if (!ownerUid || !hn) throw new Error('ownerUid and hn required');
  const secretRef = doc(db, 'users', ownerUid, 'perioPatients', hn, 'shareSecret', 'current');
  await setDoc(secretRef, { active: false }, { merge: true });
  // If you also want to hide the salt immediately, flip it too:
  // const secretSnap = await getDoc(secretRef);
  // const code = secretSnap.exists() ? secretSnap.data().code : null;
  // if (code) await setDoc(doc(db, 'publicSalts', code), { active: false }, { merge: true });
  return { ok: true };
}

/**
 * redeemShare (viewer)
 * 1) Read salt from /publicSalts/{code}
 * 2) Derive pwHash
 * 3) Create /users/{ownerUid}/perioPatients/{hn}/viewers/{viewerUid}
 *    with { shareCode, pwHash, ... } — rules validate against shareSecret/current.
 */
export async function redeemShare({ code, password }) {
  if (!code || !password) throw new Error('code and password required');

  const saltSnap = await getDoc(doc(db, 'publicSalts', code));
  if (!saltSnap.exists()) throw new Error('Invalid or expired code.');
  const { ownerUid, hn, salt, active, expiresAt } = saltSnap.data();
  if (!active) throw new Error('Share inactive.');
  if (expiresAt?.toMillis && expiresAt.toMillis() < Date.now()) throw new Error('Share expired.');

  const viewer = auth.currentUser;
  if (!viewer) throw new Error('You must be signed in to redeem (anonymous is OK).');

  const pwHash = await derivePwHash(password, salt);

  const grantRef = doc(db, 'users', ownerUid, 'perioPatients', hn, 'viewers', viewer.uid);
  await setDoc(grantRef, {
    shareCode: code,
    pwHash,
    perms: 'view',
    grantedAt: serverTimestamp()
  }, { merge: true });

  return { ownerUid, hn, perms: 'view' };
}
