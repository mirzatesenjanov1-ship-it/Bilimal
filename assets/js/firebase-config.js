// Firebase v10+ CDN Modular SDK Imports
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, push, remove, onValue, query, orderByChild, equalTo, limitToLast, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsRjj_5VoQwZA7hSBWhkQ58UvUnct-b28",
  authDomain: "bilimal-org.firebaseapp.com",
  databaseURL: "https://bilimal-org-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bilimal-org",
  storageBucket: "bilimal-org.firebasestorage.app",
  messagingSenderId: "241750360816",
  appId: "1:241750360816:web:a991434eb5afbc470d7835",
  measurementId: "G-9GSQV60QV0"
};

let app;
let auth = null;
let db = null;
let analytics = null;
let firebaseReady = false;
let firebaseError = null;
let isFirebaseAvailable = false;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  auth = getAuth(app);
  db = getDatabase(app);
  firebaseReady = true;
  isFirebaseAvailable = true;

  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics could not be initialized:", e);
  }
} catch (error) {
  firebaseError = error.message;
  isFirebaseAvailable = false;
  console.error("Firebase Initialization Error:", error);
}

export {
  app,
  auth,
  db,
  analytics,
  firebaseReady,
  firebaseError,
  isFirebaseAvailable,
  serverTimestamp,
  ref,
  set,
  get,
  update,
  push,
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
  limitToLast,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  logEvent
};
