// firebase-init.js (CDN ESM, idempotent init + global exports + helper köprüleri)
// Bu dosya hem kökte (/firebase-init.js) hem de /docs/firebase-init.js olarak aynı içeriğe sahip olmalı.

// === Firebase CDN (ESM) importları ===
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';

// === Proje yapılandırmaları ===
// Not: Canlıda doğru projeyi kullanın. Geliştirme ve prod için iki blok bırakıldı.
// 1) Üreten Eller (prod)
const firebaseConfigProd = {
  apiKey: 'AIzaSyCd9GjP6CDA8i4XByhXDHyESy-g_DHVwvQ',
  authDomain: 'ureteneller-ecaac.firebaseapp.com',
  projectId: 'ureteneller-ecaac',
  storageBucket: 'ureteneller-ecaac.firebasestorage.app',
  messagingSenderId: '368042877151',
  appId: '1:368042877151:web:ee0879fc4717928079c96a',
  measurementId: 'G-BJHKN8V4RQ'
};

// 2) Flutter AI Playground (opsiyonel / dev)
const firebaseConfigDev = {
  apiKey: 'AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo',
  authDomain: 'flutter-ai-playground-38ddf.firebaseapp.com',
  projectId: 'flutter-ai-playground-38ddf',
  storageBucket: 'flutter-ai-playground-38ddf.firebasestorage.app',
  messagingSenderId: '4688234885',
  appId: '1:4688234885:web:a3cead37ea580495ca5cec'
};

// Hangi config?
// Varsayılan: Prod. İsterseniz origin/domain kontrolüyle dev seçebilirsiniz.
const useDev = false; // gerektiğinde true yapın
const firebaseConfig = useDev ? firebaseConfigDev : firebaseConfigProd;

// === Idempotent init ===
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// === Global exportlar (window/self) ===
self.app = app; self.auth = auth; self.db = db; self.storage = storage;
self.firebaseApp = app; // olası eski kontroller için

// === Helper köprüleri (ilan-ver.html gibi sayfalar için) ===
// Storage helpers
self.storageRef = (path) => storageRef(storage, path);
self._uploadBytes = (refObj, file) => uploadBytes(refObj, file);
self._getDownloadURL = (refObj) => getDownloadURL(refObj);

// Firestore helpers
self.firebase = Object.assign(self.firebase || {}, {
  // Yol string'i gelirse otomatik doc/collection ref oluşturup set/update yapan sarmalayıcılar
  setDoc: (refOrPath, data) => {
    const ref = (typeof refOrPath === 'string') ? doc(db, ...refOrPath.split('/')) : refOrPath;
    return setDoc(ref, data);
  },
  updateDoc: (refOrPath, data) => {
    const ref = (typeof refOrPath === 'string') ? doc(db, ...refOrPath.split('/')) : refOrPath;
    return updateDoc(ref, data);
  },
  serverTimestamp: () => serverTimestamp(),
  col: (path) => collection(db, ...path.split('/')),
  mkDoc: (path) => doc(db, ...path.split('/'))
});

// Auth helper (isteğe bağlı kullanım)
self.onAuthStateChanged = (cb) => onAuthStateChanged(auth, cb);

// Konsola kısa bilgi
console.debug('[firebase-init] app:', app.options.projectId, 'auth/db/storage hazır.');
