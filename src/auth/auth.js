// src/auth/auth.js

import { auth } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

// Function to sign a new user up
export const signUp = (email, password) => {
  console.log("Attempting to sign up user:", email);
  return createUserWithEmailAndPassword(auth, email, password);
};

// Function to log an existing user in
export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Block unverified accounts
  if (!cred.user.emailVerified) {
    await signOut(auth);
    throw new Error('Please verify your email before logging in. Check your inbox or use “Resend email” in Sign Up.');
  }

  return cred; // OK to proceed
}

// Function to log the user out
export const logOut = () => {
  console.log("Attempting to log out.");
  return signOut(auth);
};