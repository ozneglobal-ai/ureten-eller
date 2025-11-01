// firebase-init.js (ESM, idempotent init + Cloudinary helpers) — 2025-10-23

// === Firebase (CDN ESM) ===
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged as _onAuthStateChanged,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  signOut as _signOut
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  setDoc, updateDoc, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {
  getStorage, ref as _storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';
import {
  getMessaging, getToken, onMessage, isSupported as messagingIsSupported
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging.js';

// === Firebase Config (istersen window.__FIREBASE_CONFIG ile override edebilirsin)
const firebaseConfig = (window.__FIREBASE_CONFIG) || {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.firebasestorage.com",
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};

// === Init (idempotent) ===
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 🔽 Persistence ayarını buraya ekle (fonksiyon içinde)
import { setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
setPersistence(auth, browserLocalPersistence).catch(()=>{});

// Global fallbacks (index/home kodu self.* bekliyor)
self.app = app; 
self.auth = auth; 
self.db = db; 
self.storage = storage;

// >>> EKLENDİ: home.html’in beklediği nesne
self.__fb = { app, auth, db, storage };

// =================== Cloudinary (ozneglobal) ===================
// Not: API SECRET asla frontend'e konulmaz.
// Aşağıdaki cloudName ve apiKey güvenle tutulabilir; upload için UNSIGNED PRESET kullan.
const CLOUD_NAME = 'ozneglobal';        // Cloud name (hesabında gözüken)
const CLOUD_API_KEY = '321492881526576';// API Key (SECRET değil)
const UPLOAD_PRESET = 'unsigned_avatars'; // Cloudinary'deki unsigned preset adın

// Yardımcı sabitler
const CL_BASE = `https://res.cloudinary.com/${CLOUD_NAME}`;
const CL_IMAGE = `${CL_BASE}/image`;
const CL_FETCH = `${CL_IMAGE}/fetch`;
const CL_UPLOAD = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// Global'e aktar (mevcut kodunla uyumlu)
self.CLOUDINARY_CLOUD = CLOUD_NAME;
self.CLOUDINARY = {
  cloud: CLOUD_NAME,
  apiKey: CLOUD_API_KEY,
  uploadPreset: UPLOAD_PRESET,
  base: CL_BASE,
  imageBase: CL_IMAGE,
  fetchBase: CL_FETCH,
  uploadEndpoint: CL_UPLOAD
};

// Basit dönüştürme string'i üret (ör: "c_fill,w_600,h_600,q_auto,f_auto")
function clTx(opts = {}) {
  const {
    w, h, c = 'fill', q = 'auto', f = 'auto', g, dpr,
    radius, ar, bg
  } = opts;
  const parts = [];
  if (c) parts.push(`c_${c}`);
  if (w) parts.push(`w_${w}`);
  if (h) parts.push(`h_${h}`);
  if (ar) parts.push(`ar_${ar}`);
  if (g) parts.push(`g_${g}`);
  if (radius) parts.push(`r_${radius}`);
  if (bg) parts.push(`b_${bg}`);
  if (dpr) parts.push(`dpr_${dpr}`);
  if (q) parts.push(`q_${q}`);
  if (f) parts.push(`f_${f}`);
  return parts.join(',');
}

// Public ID ile URL (image/upload)
self.clUrl = function clUrl(publicId, opts = {}) {
  const tx = clTx(opts);
  return tx ? `${CL_IMAGE}/upload/${tx}/${publicId}` : `${CL_IMAGE}/upload/${publicId}`;
};

// Harici URL’i fetch ile dönüştür (image/fetch)
self.clFetch = function clFetch(srcUrl, opts = {}) {
  const tx = clTx(opts);
  const encoded = encodeURIComponent(srcUrl);
  return tx ? `${CL_FETCH}/${tx}/${encoded}` : `${CL_FETCH}/${encoded}`;
};

// UNSIGNED upload (form file veya blob)
self.clUnsignedUpload = async function clUnsignedUpload(fileOrBlob, folder = 'uploads') {
  const form = new FormData();
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('file', fileOrBlob);
  if (folder) form.append('folder', folder);
  // Opsiyonel: public_id, tags, context vs. ekleyebilirsin
  const res = await fetch(CL_UPLOAD, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status}`);
  return res.json(); // { public_id, secure_url, ... }
};
self.uploadToCloudinary = self.clUnsignedUpload;

// === Örnek kullanımlar ===
self.avatarUrl = (publicId) => self.clUrl(publicId, { c:'fill', w:600, h:600, q:'auto', f:'auto', radius:'max' });
self.coverUrl  = (publicId) => self.clUrl(publicId, { c:'fill', w:1000, h:1000, q:'auto', f:'auto' });
self.fetchThumb = (src)    => self.clFetch(src, { c:'fill', w:600, h:600, q:'auto', f:'auto' });

// =================== FCM (guard'lı) ===================
(async () => {
  try {
    const supported = await messagingIsSupported();
    if (!supported) return;
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const messaging = getMessaging(app);
    self.messaging = messaging;

    // Service Worker register (docs/ sonra kök)
    let swReg = null;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/docs/firebase-messaging-sw.js', { scope: '/docs/' });
      } catch {
        try { swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js'); } catch {}
      }
    }

    // VAPID Key — kendi public key’in
    const vapidKey = 'BMsWqbSjTl3bJtZ4UPiDR_vSWSCulR4RjA9TfxLqarm9qRsYEXz2xbDQgpDOpk7-gf7KNP0WCyzecIj3SRkl9SI';
    let token = null;
    try { token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg || undefined }); } catch {}
    if (token && auth?.currentUser?.uid) {
      try {
        await setDoc(doc(db, 'fcmTokens', token), {
          uid: auth.currentUser.uid, active: true, createdAt: new Date().toISOString()
        });
      } catch {}
    }

    try {
      onMessage(messaging, (payload) => {
        const { title, body } = payload?.notification || {};
        if (title || body) { try { new Notification(title || 'Yeni mesaj', { body }); } catch {} }
      });
    } catch {}
  } catch {}
})();

// =================== Yardımcılar ===================
self.onAuthStateChanged = (a, b) => (typeof a === 'function' ? _onAuthStateChanged(auth, a) : _onAuthStateChanged(a || auth, b));
self.signInWithEmailAndPassword = (email, pass) => _signInWithEmailAndPassword(auth, email, pass);
self.signOutNow = () => _signOut(auth);

self.storageRef       = (path) => _storageRef(storage, path);
self._uploadBytes     = (refObj, file) => uploadBytes(refObj, file);
self._getDownloadURL  = (refObj) => getDownloadURL(refObj);

self.firebase = Object.assign(self.firebase || {}, {
  setDoc: (refOrPath, data, opts) => setDoc(typeof refOrPath === 'string' ? doc(db, ...refOrPath.split('/')) : refOrPath, data, opts),
  updateDoc: (refOrPath, data)    => updateDoc(typeof refOrPath === 'string' ? doc(db, ...refOrPath.split('/')) : refOrPath, data),
  getDoc: (refOrPath)             => getDoc(typeof refOrPath === 'string' ? doc(db, ...refOrPath.split('/')) : refOrPath),
  serverTimestamp: () => serverTimestamp(),
  col: (path) => collection(db, ...path.split('/')),
  q:   (...args) => query(...args),
  where, orderBy, limit,
});
self.getDocs = getDocs;

// Ready bayrağı
self.__fbReady = true;
try { document.dispatchEvent(new Event('fb-ready')); } catch (_) {}
console.debug('[firebase-init] ready:', app.options.projectId);
