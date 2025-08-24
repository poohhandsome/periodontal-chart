// src/auth/AccountModal.jsx
import React, { useState, useEffect } from "react";
import { signUp, logIn, logOut } from "./auth";
import SignUpModal from "./SignUpModal";

export default function AccountModal({ user, onClose, onSync, onLoad }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false); // only if you render a sign-up form
  const [isSignUpOpen, setSignUpOpen] = useState(false);
  useEffect(() => {
  if (user && user.emailVerified && !isSignUpOpen) onClose();
}, [user, isSignUpOpen, onClose]);
  const handleAction = async (action) => {
    setError(null);
    setIsLoading(true);
    console.log("Handle action called for:", action.name); // DEBUG

    try {
      await action(email, password);
      // Success is handled by the onAuthStateChanged listener in App.jsx.
      // The modal will re-render automatically.
    } catch (err) {
      console.error("Authentication Error:", err.message); // DEBUG
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">EasySync Account</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-3xl"
          >
            &times;
          </button>
        </div>

        {user ? (
          <div>
            <p className="text-center mb-4">
              You are logged in as <br />
              <span className="font-semibold">{user.email}</span>.
            </p>
            <div className="space-y-4">
              <button
                onClick={onSync}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? "Saving…" : "Save Current Chart to Cloud"}
              </button>
              <button
                onClick={onLoad}
                disabled={isLoading}
                className="w-full bg-gray-200 text-gray-800 p-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100"
              >
                {isLoading ? "Loading…" : "Load Chart from Cloud"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await logOut();
                  } finally {
                    window.location.reload();
                  }
                }}
                className="w-full text-center text-red-500 hover:underline mt-4"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          // VIEW FOR GUESTS
          <div>
            <p className="text-center text-gray-600 mb-6">
              Log in to save your charts to the cloud and access them from any
              device.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAction(logIn);
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full p-3 mb-4 border rounded-lg"
                required
              />
              <div className="relative mb-5">
                <input
                  type={showLoginPw ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  className="w-full p-3 pr-10 border rounded-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  aria-label={showLoginPw ? "Hide password" : "Show password"}
                  onClick={() => setShowLoginPw((v) => !v)}
                  className="absolute inset-y-0 right-3 my-auto text-gray-500 hover:text-gray-700"
                >
                  {showLoginPw ? (
                    /* eye-off */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        d="M3 3l18 18M10.584 10.587A3 3 0 0012 15a3 3 0 002.121-.879M9.88 9.88A3 3 0 0115 12m5.198-1.732C18.838 7.552 15.7 6 12 6c-1.93 0-3.73.44-5.34 1.23"
                      />
                      <path
                        strokeWidth="2"
                        d="M3.22 11.16C5.16 8.2 8.39 6 12 6c3.61 0 6.84 2.2 8.78 5.16.28.44.28 1.24 0 1.68-.47.73-1 1.39-1.6 1.98M6.62 17.38A11.93 11.93 0 0012 18c3.7 0 6.84-1.55 8.78-4.51"
                      />
                    </svg>
                  ) : (
                    /* eye */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"
                      />
                      <circle cx="12" cy="12" r="3" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isLoading ? "..." : "Log In"}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setSignUpOpen(true)}
                  className="flex-1 bg-gray-200 text-gray-800 p-3 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100"
                >
                  Sign Up
                </button>
              </div>
            </form>
          </div>
        )}
        <SignUpModal
  open={isSignUpOpen}
  initialEmail={email}
  onClose={() => setSignUpOpen(false)}
/>
      </div>
    </div>
  );
}
