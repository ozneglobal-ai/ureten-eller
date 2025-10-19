// firebase-init.js (ESM CDN, idempotent init + global köprüler + helperlar)

// === Firebase CDN (ESM) ===
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged as _onAuthStateChanged,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  signOut as _signOut
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {
  getStorage, ref as _storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';

// === PROJE CONFIG (Flutter AI Playground) ===
// Not: storageBucket yanlışsa URL üretimleri şaşar. Kural olarak `${projectId}.appspot.com` olmalı.
const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.appspot.com", // <— DÜZELTİLDİ
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
self.onAuthStateChanged = (...args) => _onAuthStateChanged(...args); // hem (auth, cb) hem (cb) çalışır
self.signInWithEmailAndPassword = (email, pass) => _signInWithEmailAndPassword(auth, email, pass);
self.signOutNow = () => _signOut(auth);

// Storage yardımcıları (ilan görselleri fallback’ı kullanıyor)
self.storageRef       = (path) => _storageRef(storage, path);
self._uploadBytes     = (refObj, file) => uploadBytes(refObj, file);
self._getDownloadURL  = (refObj) => getDownloadURL(refObj);

// Firestore köprüleri (yol-string veya ref kabul eder)
self.firebase = Object.assign(self.firebase || {}, {
  setDoc: (refOrPath, data, opts) => {
    const r = (typeof refOrPath === 'string') ? doc(db, ...refOrPath.split('/')) : refOrPath;
    return setDoc(r, data, opts);
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
  q:   (...args) => query(...args),
  where, orderBy, limit,
});

// Bazı sayfalarda global getDocs bekleniyor
self.getDocs = getDocs;

// Cloudinary (kullanıyorsan buraya gerçek cloud adını yaz)
self.CLOUDINARY_CLOUD = self.CLOUDINARY_CLOUD || 'YOUR_CLOUD_NAME';

// --- UYUMLULUK KÖPRÜSÜ: eski kodların beklediği __fb yapısı ---
self.__fb = self.__fb || {
  app, auth, db, storage,
  onAuthStateChanged: (...args) => _onAuthStateChanged(...args)
};

// Hazır sinyali (ilanlar bloğu dinliyor)
self.__fbReady = true;
try { document.dispatchEvent(new Event('fb-ready')); } catch (_) {}

console.debug('[firebase-init] ready:', app.options.projectId);
