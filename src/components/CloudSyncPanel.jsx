// src/components/CloudSyncPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listPerioCharts, savePerioChart, getPerioPatient } from '../services/firestore'; // adjust path if needed
import { listShareSecretsForOwner } from '../services/firestore';
import { createShare, redeemShare, revokeShare } from '../services/shares';

export default function CloudSyncPanel({
  open,
  user,
  onClose,
  draft,                  // { patientHN, patientName, chartData, missingTeeth, clinicalNotes }
  onLoadIntoChart,        // fn(doc) -> parent sets state & closes
}) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
const [shareHN, setShareHN] = useState('');
const [sharePassword, setSharePassword] = useState('');
const [shareTTL, setShareTTL] = useState(120); // minutes
const [shareResult, setShareResult] = useState(null);
const [sharedItems, setSharedItems] = useState([]);
const [sharedBusy, setSharedBusy] = useState(false);
const [sharedError, setSharedError] = useState('');
const [redeemCode, setRedeemCode] = useState('');
const [redeemPw, setRedeemPw] = useState('');
  const visible = open && user;
    useEffect(() => {
  if (!open || !user) return;
  (async () => {
    try {
      setSharedBusy(true);
      setSharedError('');
      const rows = await listShareSecretsForOwner(user.uid);
      setSharedItems(rows);
    } catch (e) {
      setSharedError(e.message || String(e));
    } finally {
      setSharedBusy(false);
    }
  })();
}, [open, user]);
  useEffect(() => {
    if (!visible) return;
    (async () => {
      setError('');
      setBusy(true);
      try {
        const { items, nextCursor } = await listPerioCharts(user.uid, 20);
        setItems(items);
        setCursor(nextCursor);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [visible, user]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x =>
      (x.patientHN || '').toLowerCase().includes(s) ||
      (x.patientName || '').toLowerCase().includes(s) ||
      (x.clinicalNotes || '').toLowerCase().includes(s)
    );
  }, [q, items]);

  const loadMore = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const { items: more, nextCursor } = await listPerioCharts(user.uid, 20, cursor);
      setItems(prev => [...prev, ...more]);
      setCursor(nextCursor);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft?.patientHN?.trim()) {
      alert('Please enter Patient HN before saving.');
      return;
    }
    setBusy(true);
    try {
      await savePerioChart(
        user.uid,
        draft.patientHN.trim(),
        draft.chartData,
        draft.missingTeeth,
        draft.clinicalNotes || '',
        draft.patientName || ''
      );
      alert(`Saved "${draft.patientHN}" to cloud.`);
      // Refresh the head of the list
      const { items: fresh, nextCursor } = await listPerioCharts(user.uid, 20);
      setItems(fresh);
      setCursor(nextCursor);
    } catch (e) {
      alert('Error saving: ' + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">EasySync</h1>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-gray-600">{user.email}</span>}
            <button onClick={onClose} className="px-3 py-2 rounded-lg border hover:bg-gray-50">Close</button>
          </div>
        </div>

        {/* Save current draft */}
        <div className="mt-6 p-4 border rounded-xl">
          <h2 className="font-semibold mb-2">Save current chart</h2>
          
          <p className="text-sm text-gray-600 mb-3">
            HN: <span className="font-mono">{draft?.patientHN || '(empty)'}</span> &nbsp;|&nbsp;
            Name: <span className="font-mono">{draft?.patientName || '(empty)'}</span>
          </p>
          <button
            onClick={saveDraft}
            disabled={busy}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"
          >
            {busy ? 'Saving…' : 'Save to Cloud'}
          </button>
          <button
  onClick={() => { setShareHN(draft?.patientHN || ''); setShareOpen(true); }}
  disabled={!draft?.patientHN?.trim()}
  className="ml-3 border px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
>
  Share…
</button>
        </div>
        <div className="mt-8 p-4 border rounded-xl">
  <h2 className="font-semibold mb-2">Access by code</h2>
  
  <div className="flex flex-col sm:flex-row gap-2">
    <input value={redeemCode} onChange={e=>setRedeemCode(e.target.value)} placeholder="6-digit code (e.g., 1a2B3y)" className="flex-1 p-3 border rounded-lg"/>
    <input value={redeemPw} onChange={e=>setRedeemPw(e.target.value)} type="password" placeholder="Password" className="flex-1 p-3 border rounded-lg"/>
    <button
      onClick={async () => {
        try {
          setBusy(true);
          const res = await redeemShare({ code: redeemCode.trim(), password: redeemPw });
          // Read immediately (rules now allow it)
          const data = await getPerioPatient(res.ownerUid, res.hn);
          if (!data) { alert('No data found.'); return; }
          onLoadIntoChart(data);
          onClose();
        } catch (e) {
          alert(e.message || String(e));
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy || !redeemCode.trim() || !redeemPw}
      className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300"
    >
      Access
    </button>
  </div>
  <div className="mt-10">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-lg font-semibold">Shared links (active & recent)</h2>
    <button
      onClick={async () => {
        if (!user) return;
        try {
          setSharedBusy(true);
          const rows = await listShareSecretsForOwner(user.uid);
          setSharedItems(rows);
        } catch (e) {
          alert(e.message || String(e));
        } finally {
          setSharedBusy(false);
        }
      }}
      className="text-sm px-3 py-2 rounded-lg border hover:bg-gray-50"
    >
      Refresh
    </button>
  </div>

  {sharedError && <p className="text-sm text-red-600 mb-2">{sharedError}</p>}
  {sharedBusy && <p className="text-sm text-gray-500 mb-2">Loading shared links…</p>}

  {(!sharedBusy && sharedItems.length === 0) ? (
    <p className="text-sm text-gray-500">No share links created yet.</p>
  ) : (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sharedItems.map((s) => {
        const url = `${window.location.origin}${window.location.pathname}#/share/${s.code}`;
        const exp = s.expiresAt?.toMillis ? new Date(s.expiresAt.toMillis()).toLocaleString() : '—';
        return (
          <div key={`${s.ownerUid}_${s.hn}_${s.code}`} className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">HN</div>
                <div className="font-mono font-semibold">{s.hn}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {s.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="mt-2 text-sm">
              <div>Code: <span className="font-mono">{s.code}</span></div>
              <div className="truncate">URL: <span title={url}>{url}</span></div>
              <div className="text-gray-500 mt-1">Expires: {exp}</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(url)}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                Copy URL
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(s.code)}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                Copy Code
              </button>
              <button
                onClick={async () => {
                  try {
                    if (!user) { alert('Please sign in.'); return; }
                    await revokeShare({ ownerUid: user.uid, hn: s.hn });
                    alert(`Revoked sharing for HN ${s.hn}.`);
                    // Refresh the list
                    const rows = await listShareSecretsForOwner(user.uid);
                    setSharedItems(rows);
                  } catch (e) {
                    alert(e.message || String(e));
                  }
                }}
                className="ml-auto px-3 py-2 rounded-lg border text-red-600 hover:bg-gray-50"
              >
                Revoke
              </button>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
</div>
        {/* Search + Recents */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by HN, name, or notes…"
              className="w-full p-3 border rounded-lg"
            />
          </div>

          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(doc => (
              <div key={doc.id} className="border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">HN</div>
                    <div className="font-mono font-semibold">{doc.patientHN || doc.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Updated</div>
                    <div className="text-sm">
  {doc.lastUpdated?.toDate
    ? doc.lastUpdated.toDate().toLocaleString()
    : (doc.lastUpdated
        ? new Date(doc.lastUpdated).toLocaleString()
        : "—")}
</div>
                  </div>
                </div>
                {doc.patientName && <div className="mt-2 text-sm">Name: {doc.patientName}</div>}
                {doc.clinicalNotes && (
                  <div className="mt-2 text-xs text-gray-600 line-clamp-3">{doc.clinicalNotes}</div>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      const data = await getPerioPatient(user.uid, doc.patientHN || doc.id);
                      if (!data) return alert('No data found.');
                      onLoadIntoChart(data);
                      onClose();
                    }}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700"
                  >
                    Load
                  </button>
                  <button
  onClick={() => { setShareHN(doc.patientHN || doc.id); setShareOpen(true); }}
  className="px-3 py-2 rounded-lg border hover:bg-gray-50"
>
  Share…
</button>
                </div>
              </div>
            ))}
          </div>

          {cursor && (
            <div className="mt-6">
              <button onClick={loadMore} disabled={busy} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
                {busy ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {!busy && filtered.length === 0 && (
            <p className="text-sm text-gray-500 mt-6">No records.</p>
          )}
          {shareOpen && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-3">Create share</h3>
      <div className="text-sm text-gray-600 mb-3">HN: <span className="font-mono">{shareHN || '(empty)'}</span></div>
      <input
        value={sharePassword}
        onChange={e=>setSharePassword(e.target.value)}
        type="password"
        placeholder="Set a password for recipients"
        className="w-full p-3 border rounded-lg mb-2"
      />
      <label className="text-sm text-gray-600 mb-1 block">Expires in (minutes)</label>
      <input
        value={shareTTL} onChange={e=>setShareTTL(Number(e.target.value)||60)}
        type="number" min="10" className="w-full p-3 border rounded-lg mb-3"
      />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            try {
              setBusy(true);
              if (!user) { alert('Please sign in.'); return; }
const { code, expiresAt } = await createShare({
  ownerUid: user.uid,
  hn: shareHN,
  password: sharePassword,
  ttlMinutes: shareTTL
});
              const url = `${window.location.origin}${window.location.pathname}#/share/${code}`;
              setShareResult({ code, url, expiresAt });
            } catch (e) {
              alert(e.message || String(e));
            } finally { setBusy(false); }
          }}
          disabled={busy || !shareHN?.trim() || !sharePassword}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
        >
          Create
        </button>
        <button onClick={()=>{ setShareOpen(false); setShareResult(null); setSharePassword(''); }} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Close</button>
        
      </div>

      {shareResult && (
        <div className="mt-4 p-3 border rounded-lg bg-gray-50">
          <div className="text-sm">Code: <span className="font-mono">{shareResult.code}</span></div>
          <div className="text-sm break-all">URL: {shareResult.url}</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(shareResult.url)}
              className="px-3 py-2 rounded-lg border hover:bg-white"
            >
              Copy URL
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(shareResult.code)}
              className="px-3 py-2 rounded-lg border hover:bg-white"
            >
              Copy code
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)}
        </div>
      </div>
    </div>
  );
}
