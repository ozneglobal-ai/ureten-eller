// Firebase v10 (CDN modüler)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// === Your Firebase config (as provided) ===
const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.firebasestorage.app",
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Expose helpers to window
window.UE = window.UE || {};
window.UE.firebase = {
  auth,
  // Google popup (fallback veya manuel çağrı)
  async googlePopup(){
    const res = await signInWithPopup(auth, provider);
    return res.user;
  },
  // Email signup
  async emailSignup({email, pass, displayName, username}){
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    if(displayName){
      await updateProfile(user, { displayName });
    }
    // username bilgisini Firestore’a yazmak istersen burada ekleyebilirsin.
    return user;
  },
  // Email login
  async emailLogin(email, pass){
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    return user;
  },
  // Send email verification to current user
  async sendVerify(){
    if(!auth.currentUser) throw new Error("Kullanıcı oturumu yok.");
    await sendEmailVerification(auth.currentUser);
  },
  // Password reset
  async sendReset(email){
    await sendPasswordResetEmail(auth, email);
  },
  // Sign out
  async logout(){ await signOut(auth); }
};

// Optional: auth state log
onAuthStateChanged(auth, (u)=>{
  console.log("auth state:", u ? {uid:u.uid, email:u.email, emailVerified:u.emailVerified, name:u.displayName} : null);
});
