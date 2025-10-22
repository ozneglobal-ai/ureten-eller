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
/* === GLOBAL MESSAGE NOTIFIER (arka plan ses + opsiyonel desktop bildirim) === */

// Ses kaynağı (sayfada <audio> etiketi gerektirmez)
const __ue_ding = new Audio('./notify.wav');

// Autoplay engelini bir defa kaldır (ilk kullanıcı etkileşiminde)
let __ue_audioUnlocked = false;
function __ue_unlockAudio(){
  if (__ue_audioUnlocked) return;
  __ue_ding.muted = true;
  __ue_ding.play().then(()=>{
    __ue_ding.pause(); __ue_ding.currentTime = 0;
    __ue_ding.muted = false;
    __ue_audioUnlocked = true;
  }).catch(()=>{ /* kullanıcı etkileşimine kadar kilitli kalabilir */ });
}
['click','keydown','touchstart','pointerdown'].forEach(ev=>{
  window.addEventListener(ev, __ue_unlockAudio, { once:true, capture:true });
});

// LocalStorage anahtarları
const __UE_LS_SEEN = (uid)=> `ue.lastSeen.${uid}`; // { threadId: lastMillis }
function __ue_loadSeen(uid){
  try{ return JSON.parse(localStorage.getItem(__UE_LS_SEEN(uid))||'{}'); }catch{ return {}; }
}
function __ue_saveSeen(uid, obj){
  try{ localStorage.setItem(__UE_LS_SEEN(uid), JSON.stringify(obj)); }catch{}
}

// Masaüstü bildirimi (isteğe bağlı)
function __ue_desktopNotify(title, body){
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try{ new Notification(title || 'Yeni mesaj', { body: body||'', icon: './üreteneller.png' }); }catch{}
}
// İzni sessizce iste (kullanıcı onaylarsa arka planda toast da görebilir)
if ('Notification' in window && Notification.permission === 'default'){
  Notification.requestPermission().catch(()=>{});
}

// Firestore dinleyicisini başlat
async function __ue_startGlobalNotifier(user){
  if (!self.db) return;
  const { collection, query, where, orderBy, onSnapshot } =
    await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');

  const uid = user.uid;
  const seen = __ue_loadSeen(uid);

  // Katılımcısı olduğum tüm konuşmalar, son mesaja göre sıralı
  const q = query(
    collection(self.db, 'messages'),
    where('participants','array-contains', uid),
    orderBy('lastAt','desc')
  );

  onSnapshot(q, (snap)=>{
    snap.forEach(ds=>{
      const d = ds.data()||{};
      const threadId = ds.id;

      const lastMillis = d.lastAt?.toMillis ? d.lastAt.toMillis()
                        : (d.lastAt ? new Date(d.lastAt).getTime() : 0);
      const prev = seen[threadId] || 0;

      // Yeni mesaj ve benden değilse
      if (lastMillis && lastMillis > prev && d.lastText && d.lastFrom && d.lastFrom !== uid){
        __ue_ding.play().catch(()=>{});              // SES 📣
        if (document.hidden) {                       // Sekme arkadaysa opsiyonel desktop bildirimi
          __ue_desktopNotify(d.otherName || 'Yeni mesaj', d.lastText);
        }
        seen[threadId] = lastMillis;
        __ue_saveSeen(uid, seen);
      } else if (!seen[threadId]) {
        // İlk yüklemede başlangıç damgasını yaz
        seen[threadId] = lastMillis || 0;
        __ue_saveSeen(uid, seen);
      }
    });
  }, (err)=> console.warn('[notify] snapshot error:', err));
}

// Auth hazır olduğunda notifier’ı bağla (TÜM SAYFALARDA çalışır)
try{
  self.onAuthStateChanged(self.auth, (u)=>{
    if (u) __ue_startGlobalNotifier(u);
  });
}catch(e){
  console.warn('[notify] onAuthStateChanged bağlanamadı:', e);
}

