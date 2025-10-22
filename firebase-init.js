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
  setDoc, updateDoc, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import {
  getStorage, ref as _storageRef, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';
import {
  getMessaging, getToken, onMessage
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging.js';

// === PROJE CONFIG ===
const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.firebasestorage.app",
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};

// === Init ===
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

self.app = app;
self.auth = auth;
self.db = db;
self.storage = storage;

// =================== FCM Messaging ===================
try {
  const messaging = getMessaging(app);
  self.messaging = messaging;

  if ('Notification' in window) {
    Notification.requestPermission().then(async (perm) => {
      if (perm === 'granted') {
        try {
          // 🔸 senin gerçek VAPID Public Key’in
          const vapidKey = 'BMsWqbSjTl3bJtZ4UPiDR_vSWSCulR4RjA9TfxLqarm9qRsYEXz2xbDQgpDOpk7-gf7KNP0WCyzecIj3SRkl9SI';

          // 🔧 Service Worker docs/ altında
          let swReg = null;
          try {
            if ('serviceWorker' in navigator) {
              swReg = await navigator.serviceWorker.register('/docs/firebase-messaging-sw.js', { scope: '/docs/' });
              console.debug('[fcm] service worker registered (docs):', swReg);
            }
          } catch (swErr) {
            console.warn('[fcm] service worker register failed (docs):', swErr);
          }

          const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swReg || undefined
          });

          if (token && self.auth?.currentUser?.uid) {
            await setDoc(doc(db, 'fcmTokens', token), {
              uid: self.auth.currentUser.uid,
              active: true,
              createdAt: new Date().toISOString()
            });
            console.debug('[fcm] token kaydedildi:', token);
          } else {
            console.debug('[fcm] token alınamadı veya kullanıcı yok');
          }
        } catch (err) {
          console.warn('[fcm] token alınamadı', err);
        }
      }
    }).catch(()=>{});
  }

  onMessage(messaging, (payload) => {
    console.debug('[fcm] ön plan bildirimi:', payload);
    const { title, body } = payload.notification || {};
    if (title || body) {
      try { new Notification(title || 'Yeni mesaj', { body }); } catch {}
    }
  });
} catch (e) {
  console.warn('[fcm] başlatılamadı', e);
}

// =================== Yardımcılar ===================
self.onAuthStateChanged = (a, b) => {
  if (typeof a === 'function') return _onAuthStateChanged(auth, a);
  return _onAuthStateChanged(a || auth, b);
};

self.signInWithEmailAndPassword = (email, pass) => _onAuthStateChanged ? _signInWithEmailAndPassword(auth, email, pass) : Promise.reject('auth not ready');
self.signOutNow = () => _signOut(auth);

self.storageRef       = (path) => _storageRef(storage, path);
self._uploadBytes     = (refObj, file) => uploadBytes(refObj, file);
self._getDownloadURL  = (refObj) => getDownloadURL(refObj);

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

self.getDocs = getDocs;
self.CLOUDINARY_CLOUD = self.CLOUDINARY_CLOUD || 'YOUR_CLOUD_NAME';
self.__fb = self.__fb || {
  app, auth, db, storage,
  onAuthStateChanged: (...args) => _onAuthStateChanged(...args)
};

const __briefCache = new Map();
self.getUserBrief = async function getUserBrief(uid){
  if (!uid) return { name:'Kullanıcı', avatar:'/assets/img/avatar-default.png' };
  if (__briefCache.has(uid)) return __briefCache.get(uid);
  try{
    const snap = await getDoc(doc(db, 'users', uid));
    const d = snap.exists() ? (snap.data()||{}) : {};
    const name = [d.name||d.firstName||'', d.surname||d.lastName||''].filter(Boolean).join(' ') || d.displayName || 'Kullanıcı';
    const brief = { name, avatar: d.avatar||d.photoURL||'/assets/img/avatar-default.png' };
    __briefCache.set(uid, brief);
    return brief;
  }catch{
    return { name:'Kullanıcı', avatar:'/assets/img/avatar-default.png' };
  }
};

self.computePairKey = (a, b)=> [a||'', b||''].sort().join('_');
self.resolveOtherUid = (me, participants = [], otherUidMap = {})=>{
  if (otherUidMap && otherUidMap[me]) return otherUidMap[me];
  if (Array.isArray(participants)) {
    const other = participants.find(x => x && x !== me);
    if (other) return other;
  }
  return '';
};

self.__fbReady = true;
try { document.dispatchEvent(new Event('fb-ready')); } catch (_) {}

console.debug('[firebase-init] ready:', app.options.projectId);

if (!self.__ue_notifierBound) {
  self.__ue_notifierBound = true;
  const dingSrc = (location.pathname.startsWith('/docs/')) ? './notify.wav' : '/notify.wav';
  const __ue_ding = new Audio(dingSrc);
  let __ue_audioUnlocked = false;
  function __ue_unlockAudio(){
    if (__ue_audioUnlocked) return;
    __ue_ding.muted = true;
    __ue_ding.play().then(()=>{
      __ue_ding.pause(); __ue_ding.currentTime = 0;
      __ue_ding.muted = false;
      __ue_audioUnlocked = true;
    }).catch(()=>{});
  }
  ['click','keydown','touchstart','pointerdown'].forEach(ev=>{
    window.addEventListener(ev, __ue_unlockAudio, { once:true, capture:true });
  });

  const __UE_LS_SEEN = (uid)=> `ue.lastSeen.${uid}`;
  function __ue_loadSeen(uid){ try{ return JSON.parse(localStorage.getItem(__UE_LS_SEEN(uid))||'{}'); }catch{ return {}; } }
  function __ue_saveSeen(uid, obj){ try{ localStorage.setItem(__UE_LS_SEEN(uid), JSON.stringify(obj)); }catch{} }

  function __ue_desktopNotify(title, body){
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try{ new Notification(title || 'Yeni mesaj', { body: body||'', icon: (location.pathname.startsWith('/docs/')? './üreteneller.png' : '/üreteneller.png') }); }catch{}
  }

  if ('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission().catch(()=>{});
  }

  async function __ue_startGlobalNotifier(user){
    const uid = user?.uid;
    if (!uid || !db) return;
    const qThreads = query(
      collection(db, 'messages'),
      where('participants','array-contains', uid)
    );
    onSnapshot(qThreads, async (snap)=>{
      const seen = __ue_loadSeen(uid);
      const rows = [];
      snap.forEach(ds => {
        const d = ds.data()||{};
        rows.push({ id: ds.id, data: d });
      });
      rows.sort((a,b)=>{
        const ta = a.data.lastAt?.toMillis ? a.data.lastAt.toMillis() : (a.data.lastAt ? new Date(a.data.lastAt).getTime() : 0);
        const tb = b.data.lastAt?.toMillis ? b.data.lastAt.toMillis() : (b.data.lastAt ? new Date(b.data.lastAt).getTime() : 0);
        return (tb||0) - (ta||0);
      });

      for (const row of rows){
        const d = row.data;
        const threadId = row.id;
        try{
          const participants = Array.isArray(d.participants) ? d.participants : [];
          const me = uid;
          const peer = self.resolveOtherUid(me, participants, d.otherUidMap||{});
          let patch = {};
          if (!d.pairKey && peer) patch.pairKey = self.computePairKey(me, peer);
          if ((!d.otherUidMap || !d.otherUidMap[me] || !d.otherUidMap[peer]) && peer)
            patch.otherUidMap = Object.assign({}, d.otherUidMap||{}, { [me]: peer, [peer]: me });
          if (Object.keys(patch).length)
            updateDoc(doc(db,'messages',threadId), patch).catch(()=>{});
        }catch{}
      }
    });
  }

  try{
    self.onAuthStateChanged(auth, (u)=>{ if (u) __ue_startGlobalNotifier(u); });
  }catch(e){
    console.warn('[notify] onAuthStateChanged bağlanamadı:', e);
  }
}
