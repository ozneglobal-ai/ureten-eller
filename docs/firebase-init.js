// /firebase-init.js  — Firebase v10 (CDN, modüler)

// --- SDK'lar ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  doc, setDoc, addDoc, collection, serverTimestamp,
  getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";


// --- Config (KENDİ PROJEN) ---
export const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  // Storage bucket doğru format: {project}.appspot.com
  storageBucket: "flutter-ai-playground-38ddf.appspot.com",
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};


// --- Uygulama & Servisler ---
export const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);


// --- Oturum akışı (anonim fallback) ---
onAuthStateChanged(auth, async (u) => {
  try {
    if (!u) { await signInAnonymously(auth); }
  } catch (e) {
    console.error("Anonim oturum açılamadı:", e);
  }
});


// --- Eski kodla uyumlu global yardımcılar ---
const provider = new GoogleAuthProvider();

window.UE = window.UE || {};
window.UE.firebase = {
  auth,
  async googlePopup(){
    const res = await signInWithPopup(auth, provider);
    return res.user;
  },
  async emailSignup({email, pass, displayName}){
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName){ await updateProfile(user, { displayName }); }
    return user;
  },
  async emailLogin(email, pass){
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    return user;
  },
  async sendVerify(){
    if (!auth.currentUser) throw new Error("Kullanıcı oturumu yok.");
    await sendEmailVerification(auth.currentUser);
  },
  async sendReset(email){
    await sendPasswordResetEmail(auth, email);
  },
  async logout(){
    await signOut(auth);
  }
};

// Global kısa yol (profile.html bekliyor olabilir)
window.__fb = { app, auth, db, storage, onAuthStateChanged };


// --- Live Support (Canlı Destek) yardımcıları ---
export const support = {
  // Kullanıcı için konuşma dokümanı hazırla / güncelle
  async ensureConversation(){
    if (!auth.currentUser) {
      try { await signInAnonymously(auth); } catch {}
    }
    const u = auth.currentUser;
    if (!u) return null;

    const ref = doc(db, "conversations", u.uid);
    await setDoc(ref, {
      userId: u.uid,
      userName: u.displayName || "",
      userEmail: u.email || "",
      lastMessage: "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    return { uid: u.uid };
  },

  // Mesaj gönder: /conversations/{uid}/messages/*
  async sendMessage(text){
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    const u = auth.currentUser;
    if (!u) throw new Error("auth-missing");

    const convRef = doc(db, "conversations", u.uid);

    await addDoc(collection(convRef, "messages"), {
      text: String(text || ""),
      from: u.uid,
      createdAt: serverTimestamp()
    });

    await setDoc(convRef, {
      lastMessage: String(text || ""),
      updatedAt: serverTimestamp(),
      userId: u.uid,
      userName: u.displayName || "",
      userEmail: u.email || ""
    }, { merge: true });

    return u.uid;
  },

  // Konuşmayı tamamen sil
  async deleteConversation(){
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    const u = auth.currentUser;
    if (!u) throw new Error("auth-missing");

    const convRef = doc(db, "conversations", u.uid);

    // Alt koleksiyondaki tüm mesajları sil
    const msgsSnap = await getDocs(collection(convRef, "messages"));
    for (const d of msgsSnap.docs){
      await deleteDoc(d.ref);
    }

    // Üst dokümanı da sil
    await deleteDoc(convRef);
  }
};

// inline scriptler erişsin
window.UE.support = support;
