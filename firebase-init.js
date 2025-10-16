// /firebase-init.js  — Firebase v10 (CDN, modüler)

// SDK'lar
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage }    from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

// Config (yeni proje)
export const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.firebasestorage.app",
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};

// === UYGULAMA VE SERVISLER (EXPORT EDİLİYOR) ===
export const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// === (İsteğe bağlı) Global yardımcılar: eski kodun bozulmaması için bırakıyoruz ===
const provider = new GoogleAuthProvider();
window.UE = window.UE || {};
window.UE.firebase = {
  auth,
  async googlePopup(){ const res = await signInWithPopup(auth, provider); return res.user; },
  async emailSignup({email, pass, displayName}){
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    if(displayName){ await updateProfile(user, { displayName }); }
    return user;
  },
  async emailLogin(email, pass){
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    return user;
  },
  async sendVerify(){
    if(!auth.currentUser) throw new Error("Kullanıcı oturumu yok.");
    await sendEmailVerification(auth.currentUser);
  },
  async sendReset(email){ await sendPasswordResetEmail(auth, email); },
  async logout(){ await signOut(auth); }
};

// (Opsiyonel debug)
onAuthStateChanged(auth, (u) => {
  // console.log("auth state:", u ? { uid: u.uid, email: u.email, verified: u.emailVerified } : null);
});

// Global kısa yol (profile.html burayı bekliyor)
window.__fb = { app, auth, db, storage, onAuthStateChanged };

// === Live Support helpers ===
import {
  getFirestore, doc, setDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

export const support = {
  async ensureConversation(){
    const auth = getAuth();
    if (!auth.currentUser) { try{ await signInAnonymously(auth); }catch{} }
    const u = auth.currentUser; if (!u) return null;
    const db = getFirestore();
    const ref = doc(db, "conversations", u.uid);
    await setDoc(ref, {
      userId: u.uid,
      userName: u.displayName || "",
      userEmail: u.email || "",
      lastMessage: "",
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { db, uid: u.uid };
  },
  async sendMessage(text){
    const auth = getAuth(); const db = getFirestore();
    if (!auth.currentUser) { await signInAnonymously(auth); }
    const u = auth.currentUser; if (!u) throw new Error("auth-missing");
    const ref = doc(db, "conversations", u.uid);
    await addDoc(collection(ref, "messages"), {
      text: String(text||""),
      from: u.uid,
      createdAt: serverTimestamp()
    });
    await setDoc(ref, {
      lastMessage: String(text||""),
      updatedAt: serverTimestamp(),
      userId: u.uid,
      userName: u.displayName || "",
      userEmail: u.email || ""
    }, { merge: true });
    return u.uid;
  }
};

// inline scriptler erişsin
window.UE = window.UE || {};
window.UE.support = support;


