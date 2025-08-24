// src/pages/ShareRedeemPage.jsx
import React, { useEffect, useState } from 'react';
import { redeemShare } from '../services/shares';
import { getPerioPatient } from '../services/firestore';
import { auth } from '../services/firebase';
import { signInAnonymously } from 'firebase/auth';

export default function ShareRedeemPage({ code, onLoaded }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    // Optional: anonymous login for frictionless viewing
    if (!auth.currentUser) signInAnonymously(auth).catch(()=>{});
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow">
        <h1 className="text-xl font-bold mb-2">Access Shared Chart</h1>
        <p className="text-sm text-gray-600 mb-4">Code: <span className="font-mono">{code}</span></p>
        <input
          type="password"
          value={pw}
          onChange={e=>setPw(e.target.value)}
          placeholder="Password"
          className="w-full p-3 border rounded-lg mb-3"
        />
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <button
          onClick={async () => {
            try {
              setBusy(true); setErr('');
              const res = await redeemShare({ code, password: pw });
              const data = await getPerioPatient(res.ownerUid, res.hn);
              if (!data) { setErr('No data found.'); return; }
              // stash once; Perio page will auto-load it
              localStorage.setItem('pendingLoad', JSON.stringify({ ownerUid: res.ownerUid, hn: res.hn }));
              window.location.hash = '#/periodontal-chart';
            } catch (e) {
              setErr(e.message || String(e));
            } finally { setBusy(false); }
          }}
          disabled={busy || !pw}
          className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-300"
        >
          {busy ? 'Accessing…' : 'Access'}
        </button>
      </div>
    </div>
  );
}