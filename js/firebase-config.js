import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction,
  Timestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: window.__env?.FIREBASE_API_KEY,
  authDomain: window.__env?.FIREBASE_AUTH_DOMAIN,
  projectId: window.__env?.FIREBASE_PROJECT_ID,
  storageBucket: window.__env?.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.__env?.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.__env?.FIREBASE_APP_ID,
};

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingKeys.length) {
  console.error("Firebase config incompleto. Revisá env.js. Faltan:", missingKeys.join(", "));
  throw new Error(`Firebase config incompleto. Revisá env.js. Faltan: ${missingKeys.join(", ")}`);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authReady = setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("No pude aplicar persistencia local de sesión:", error);
  })
  .then(
    () =>
      new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, () => {
          unsubscribe();
          resolve();
        });
      })
  );

export {
  app,
  auth,
  db,
  authReady,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction,
  Timestamp,
  onSnapshot,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  deleteUser
};
