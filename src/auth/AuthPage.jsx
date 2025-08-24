// src/auth/AuthPage.jsx

import React, { useState } from 'react';
import { signUp, logIn } from './auth';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogIn = async (e) => {
    e.preventDefault(); // Prevents the form from reloading the page
    setError(null);
    setIsLoading(true);
    console.log("Attempting to log in..."); // For debugging

    try {
      await logIn(email, password);
      // If successful, onAuthStateChanged in App.jsx will handle the redirect.
      console.log("Login successful!");
    } catch (err) {
      console.error("Login failed:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); // Prevents the form from reloading the page
    setError(null);
    setIsLoading(true);
    console.log("Attempting to sign up..."); // For debugging

    try {
      await signUp(email, password);
      console.log("Signup successful!");
    } catch (err) {
      console.error("Signup failed:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">EasyPerio Login</h1>
        <form onSubmit={handleLogIn}> {/* We can use onSubmit here */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-2 mb-4 border rounded"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-2 mb-4 border rounded"
            required
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex flex-col gap-4">
            <button
              type="submit" // This is now the primary action for the form
              disabled={isLoading}
              className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isLoading ? 'Logging In...' : 'Log In'}
            </button>
            <button
              type="button" // This button does NOT submit the form
              disabled={isLoading}
              onClick={handleSignUp}
              className="w-full bg-gray-200 text-gray-800 p-2 rounded hover:bg-gray-300 disabled:bg-gray-100"
            >
              {isLoading ? 'Working...' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}