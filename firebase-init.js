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

// =================== Yardımcılar (Auth / Storage / Firestore) ===================

// onAuthStateChanged köprüsü: hem (cb) hem (auth, cb) destekler
self.onAuthStateChanged = (a, b) => {
  if (typeof a === 'function') return _onAuthStateChanged(auth, a); // (cb)
  return _onAuthStateChanged(a || auth, b);                         // (auth, cb)
};

self.signInWithEmailAndPassword = (email, pass) => _onAuthStateChanged ? _signInWithEmailAndPassword(auth, email, pass) : Promise.reject('auth not ready');
self.signOutNow = () => _signOut(auth);

// Storage yardımcıları
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

// =================== Profil Kısa Bilgi Helper ===================
/**
 * users/{uid} içinden ad/soyad + avatar bilgisini derler.
 * Global: self.getUserBrief(uid): Promise<{name, avatar}>
 */
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

// =================== 1-1 Sohbet Anahtarları (pairKey) ===================
/**
 * Deterministik 1-1 anahtar: [uidA, uidB].sort().join('_')
 * Eski kayıtlar için otherUidMap tamamlama yardımcıları.
 */
self.computePairKey = (a, b)=> [a||'', b||''].sort().join('_');
self.resolveOtherUid = (me, participants = [], otherUidMap = {})=>{
  if (otherUidMap && otherUidMap[me]) return otherUidMap[me];
  if (Array.isArray(participants)) {
    const other = participants.find(x => x && x !== me);
    if (other) return other;
  }
  return '';
};

// =================== Global Ready Sinyali ===================
self.__fbReady = true;
try { document.dispatchEvent(new Event('fb-ready')); } catch (_) {}

console.debug('[firebase-init] ready:', app.options.projectId);

// ======================================================================
// ========== GLOBAL MESSAGE NOTIFIER (arka plan ses + desktop) ==========
// ======================================================================

// Birden fazla kez import edilirse tekrar bağlanmayı önle
if (!self.__ue_notifierBound) {
  self.__ue_notifierBound = true;

  // Ses kaynağı (sayfada <audio> etiketi gerektirmez)
  // Yol tespiti: docs/ altında ise relatif, kökteyse absolute
  const dingSrc = (location.pathname.startsWith('/docs/')) ? './notify.wav' : '/notify.wav';
  const __ue_ding = new Audio(dingSrc);

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
    try{ new Notification(title || 'Yeni mesaj', { body: body||'', icon: (location.pathname.startsWith('/docs/')? './üreteneller.png' : '/üreteneller.png') }); }catch{}
  }
  // İzni sessizce iste
  if ('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission().catch(()=>{});
  }

  // Firestore dinleyicisini başlat
  async function __ue_startGlobalNotifier(user){
    const uid = user?.uid;
    if (!uid || !db) return;

    // === DÜZELTME: orderBy('lastAt','desc') KALDIRILDI ===
    // Composite index gereksinimini ortadan kaldırıyoruz.
    const qThreads = query(
      collection(db, 'messages'),
      where('participants','array-contains', uid)
      // orderBy('lastAt','desc')  ❌ KALDIRILDI
    );

    onSnapshot(qThreads, async (snap)=>{
      const seen = __ue_loadSeen(uid);

      // Snapshot’tan dizi çıkar -> client-side sırala (lastAt desc)
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

      // Sıralı listede tetikleme kontrolü
      for (const row of rows){
        const d = row.data;
        const threadId = row.id;

        // pairKey/otherUidMap eksikse mümkünse tamamla (uyumluluk düzeltmesi)
        try{
          const participants = Array.isArray(d.participants) ? d.participants : [];
          const me = uid;
          const peer = self.resolveOtherUid(me, participants, d.otherUidMap||{});
          // pairKey yoksa/set değilse ekle
          let patch = {};
          if (!d.pairKey && peer) {
            patch.pairKey = self.computePairKey(me, peer);
          }
          // otherUidMap eksikse ekle
          if ((!d.otherUidMap || !d.otherUidMap[me] || !d.otherUidMap[peer]) && peer) {
            patch.otherUidMap = Object.assign({}, d.otherUidMap||{}, { [me]: peer, [peer]: me });
          }
          if (Object.keys(patch).length){
            // Sessiz güncelleme
            updateDoc(doc(db,'messages',threadId), patch).catch(()=>{});
          }
        }catch{ /* sessiz */ }

        // zaman ve tetikleme
        const lastMillis = d.lastAt?.toMillis ? d.lastAt.toMillis()
                          : (d.lastAt ? new Date(d.lastAt).getTime() : 0);
        const prev = seen[threadId] || 0;

        if (lastMillis && lastMillis > prev && d.lastText && d.lastFrom && d.lastFrom !== uid){
          // SES 📣
          __ue_ding.play().catch(()=>{});
          // Sekme arkadaysa masaüstü bildirimi
          if (document.hidden) {
            // Başlık için - yazan kişinin kısa adı
            let title = 'Yeni mesaj';
            try{
              const brief = await self.getUserBrief(d.lastFrom);
              title = brief?.name || (d.otherName || 'Yeni mesaj');
            }catch{}
            __ue_desktopNotify(title, d.lastText);
          }
          seen[threadId] = lastMillis;
          __ue_saveSeen(uid, seen);
        } else if (!seen[threadId]) {
          // İlk yüklemede başlangıç damgasını yaz
          seen[threadId] = lastMillis || 0;
          __ue_saveSeen(uid, seen);
        }
      }
    }, (err)=> console.warn('[notify] snapshot error:', err));
  }

  // Auth hazır olduğunda notifier’ı bağla (TÜM SAYFALARDA çalışır)
  try{
    self.onAuthStateChanged(auth, (u)=>{
      if (u) __ue_startGlobalNotifier(u);
    });
  }catch(e){
    console.warn('[notify] onAuthStateChanged bağlanamadı:', e);
  }
}
