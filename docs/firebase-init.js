// firebase-init.js (ESM CDN, idempotent init + global exports + helperlar)

// === Firebase CDN (ESM) ===
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';

// === SENİN PROJE CONFIG'in (Flutter AI Playground) ===
const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.firebasestorage.app"
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};

// === Idempotent init (aynı sayfada iki kez init olmaz) ===
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// === Global exportlar (window/self) ===
self.app = app;
self.auth = auth;
self.db = db;
self.storage = storage;

// Auth yardımcıları
self.onAuthStateChanged = (cb) => onAuthStateChanged(auth, cb);
self.signInWithEmailAndPassword = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
self.signOutNow = () => signOut(auth);

// Storage yardımcıları (ilan sayfası kullanıyor)
self.storageRef = (path) => storageRef(storage, path);
self._uploadBytes = (refObj, file) => uploadBytes(refObj, file);
self._getDownloadURL = (refObj) => getDownloadURL(refObj);

// Firestore yardımcıları (yol-string veya ref kabul eder)
self.firebase = Object.assign(self.firebase || {}, {
  setDoc: (refOrPath, data) => {
    const r = (typeof refOrPath === 'string') ? doc(db, ...refOrPath.split('/')) : refOrPath;
    return setDoc(r, data);
  },
  updateDoc: (refOrPath, data) => {
    const r = (typeof refOrPath === 'string') ? doc(db, ...refOrPath.split('/')) : refOrPath;
    return updateDoc(r, data);
  },
  getDoc: (refOrPath) => {
    const r = (typeof refOrPath === 'string') ? doc(db, ...refOrPath.split('/')) : refOrPath;
    return getDoc(r);
  },
  serverTimestamp: () => serverTimestamp(),
  col: (path) => collection(db, ...path.split('/')),
  q: (...args) => query(...args),
  where,
  orderBy,
  limit,
});

// (İsteğe bağlı) getDocs’u da globale veriyorum; bazı sayfalarda işine yarar
self.getDocs = getDocs;

console.debug('[firebase-init] ready:', app.options.projectId);

// --- UYUMLULUK KÖPRÜSÜ: window.__fb bekleyen sayfalar için (ekleme) ---
self.__fb = self.__fb || {
  app,
  auth,
  db,
  storage,
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb)
};
