// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration that you copied
const firebaseConfig = {
  apiKey: "AIzaSyCp3zQV3NOQgG0oOeq9-iA0GpTT1Xqdjjo",
  authDomain: "easyperio-clinic.firebaseapp.com",
  projectId: "easyperio-clinic",
  storageBucket: "easyperio-clinic.firebasestorage.app",
  messagingSenderId: "1041555736481",
  appId: "1:1041555736481:web:5af3b62e5f7a1f10d5ede0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services you need for easy access in other files
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);