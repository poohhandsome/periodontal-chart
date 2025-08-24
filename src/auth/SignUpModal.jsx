// src/auth/SignUpModal.jsx
import React, { useState } from 'react';
import { auth } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
} from 'firebase/auth';

export default function SignUpModal({ open, initialEmail = '', onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // 'form' | 'info'
  const [resent, setResent] = useState(false);
  if (!open) return null;
  const handleResend = async () => {
  setError('');
  setIsLoading(true);
  setResent(false);
  try {
    // Temporarily sign in with the same credentials, send a new verification, then sign out again.
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (user.emailVerified) {
      await signOut(auth);
      setError('This email is already verified. You can now log in.');
      return;
    }
    await sendEmailVerification(user, {
      url: `${window.location.origin}${window.location.pathname}#/auth-verified`
    });
    await signOut(auth);
    setResent(true);
  } catch (e) {
    setError(e?.message || String(e));
  } finally {
    setIsLoading(false);
  }
};
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // 1) create account (this signs the user in)
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // 2) set display name
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      // 3) send verification email
      await sendEmailVerification(cred.user, {url: `${window.location.origin}${window.location.pathname}#/auth-verified`});
      // 4) immediately sign out — user must verify before using the app
      await signOut(auth);
      // 5) show the info step
      setStep('info');
    } catch (err) {
      // Friendly messages for common cases
      const msg = err?.code === 'auth/email-already-in-use'
        ? 'This email is already registered. Please log in or use another email.'
        : err?.message || String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {step === 'form' ? 'Create Account' : 'Verify Your Email'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                className="w-full p-3 border rounded-lg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 border rounded-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="relative mb-1">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full p-3 pr-10 border rounded-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw(v => !v)}
                  className="absolute inset-y-0 right-3 my-auto text-gray-500 hover:text-gray-700"
                >
                  {showPw ? (
                    // eye-off
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" d="M3 3l18 18M10.584 10.587A3 3 0 0012 15a3 3 0 002.121-.879M9.88 9.88A3 3 0 0115 12m5.198-1.732C18.838 7.552 15.7 6 12 6c-1.93 0-3.73.44-5.34 1.23" />
                      <path strokeWidth="2" d="M3.22 11.16C5.16 8.2 8.39 6 12 6c3.61 0 6.84 2.2 8.78 5.16.28.44.28 1.24 0 1.68-.47.73-1 1.39-1.6 1.98M6.62 17.38A11.93 11.93 0 0012 18c3.7 0 6.84-1.55 8.78-4.51" />
                    </svg>
                  ) : (
                    // eye
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z" />
                      <circle cx="12" cy="12" r="3" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        ) : (
          <div>
    <p className="text-gray-700">
      We have sent a verification link to:<br />
      <span className="font-semibold">{email}</span>
    </p>
    <ul className="list-disc ml-5 text-gray-600 mt-3 space-y-1">
      <li>Open your inbox and click the link to verify this address.</li>
      <li>Check <span className="font-semibold">Spam</span> or <span className="font-semibold">Promotions</span> if you don’t see it.</li>
      <li>You must verify before you can sign in and use EasySync.</li>
    </ul>

    {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    {resent && <p className="text-green-700 text-sm mt-3">Verification email sent again.</p>}

    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Close</button>
      <button
        onClick={handleResend}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
      >
        {isLoading ? 'Resending…' : 'Resend email'}
      </button>
      
    </div>
  </div>
        )}
      </div>
    </div>
  );
}
