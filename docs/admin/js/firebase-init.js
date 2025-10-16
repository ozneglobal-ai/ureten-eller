// /firebase-init.js  (GÜNCEL)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage }    from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBqYJBZ95AOV-ojKGV0MZn42-OnJYQkdAo",
  authDomain: "flutter-ai-playground-38ddf.firebaseapp.com",
  projectId: "flutter-ai-playground-38ddf",
  storageBucket: "flutter-ai-playground-38ddf.firebasestorage.app",
  messagingSenderId: "4688234885",
  appId: "1:4688234885:web:a3cead37ea580495ca5cec"
};

export const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
