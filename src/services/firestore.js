// src/services/firestore.js

import { db } from './firebase';
import {
  collection, doc, getDoc, setDoc,
  getDocs, query, orderBy, limit, startAfter, serverTimestamp, where,  collectionGroup,
} from 'firebase/firestore';

// --- Periodontal Chart Functions ---

// Pass the logged-in user's ID to the function
export async function savePerioChart(
  userId,
  patientHN,
  chartData,
  missingTeeth,
  clinicalNotes,
  patientName = ''
) {
  try {
    const patientDocRef = doc(db, "users", userId, "perioPatients", patientHN);
    await setDoc(
      patientDocRef,
      {
        patientHN,
        patientName,
        chartData,
        missingTeeth,
        clinicalNotes,
        // keep a single canonical timestamp field for ordering
        lastUpdated: serverTimestamp()
      },
      { merge: true }
    );
    console.log("Perio chart saved successfully for user:", userId);
  } catch (e) {
    console.error("Error saving perio chart: ", e);
    throw e;
  }
}
export async function listShareSecretsForOwner(ownerUid) {
  const patientsCol = collection(db, 'users', ownerUid, 'perioPatients');
  const patSnap = await getDocs(patientsCol);

  // read all shareSecret/current in parallel
  const tasks = patSnap.docs.map(async (patDoc) => {
    const hn = patDoc.id;
    const secRef = doc(db, 'users', ownerUid, 'perioPatients', hn, 'shareSecret', 'current');
    const secSnap = await getDoc(secRef);
    if (!secSnap.exists()) return null;

    const s = secSnap.data();
    return {
      ownerUid,
      hn,
      code: s.code,
      active: !!s.active,
      expiresAt: s.expiresAt || null,
      perms: s.perms || 'view'
    };
  });

  const rows = (await Promise.all(tasks)).filter(Boolean);

  // newest first by expiry if present
  rows.sort((a, b) => {
    const ax = a.expiresAt?.toMillis ? a.expiresAt.toMillis() : 0;
    const bx = b.expiresAt?.toMillis ? b.expiresAt.toMillis() : 0;
    return bx - ax;
  });

  return rows;
}
export async function getPerioPatient(userId, patientHN) {
    const patientDocRef = doc(db, "users", userId, "perioPatients", patientHN);
    const docSnap = await getDoc(patientDocRef);
    return docSnap.exists() ? docSnap.data() : null;
}
export async function listPerioCharts(userId, pageSize = 20, cursor = null) {
  const base = collection(db, "users", userId, "perioPatients");
  const q = cursor
    ? query(base, orderBy("lastUpdated", "desc"), startAfter(cursor), limit(pageSize))
    : query(base, orderBy("lastUpdated", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data(), _ref: d }));
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}
// --- Plaque Index Functions (Example) ---

export async function savePlaqueChart(userId, patientHN, plaqueData, missingTeeth) {
  try {
    const patientDocRef = doc(db, "users", userId, "plaquePatients", patientHN);
    await setDoc(patientDocRef, {
        patientHN,
        plaqueData,
        missingTeeth,
        lastUpdated: new Date()
    }, { merge: true });
  } catch (e) {
    console.error("Error saving plaque chart: ", e);
  }
}