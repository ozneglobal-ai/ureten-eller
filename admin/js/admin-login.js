// /admin/js/admin-login.js

import { auth, db } from "/firebase-init.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/** İsteğe bağlı: bu e-posta her koşulda admin kabul edilsin */
const ADMIN_EMAIL = "ozneglobal@gmail.com";

/* ------- DOM ------- */
const form    = document.getElementById("loginForm");
const errEl   = document.getElementById("err");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const submit  = form?.querySelector('button[type="submit"]');
const showBtn = document.getElementById("togglePassword"); // varsa kullanılır

/* ------- Yardımcılar ------- */
function disable(state){
  if (submit)  submit.disabled  = state;
  if (emailEl) emailEl.disabled = state;
  if (passEl)  passEl.disabled  = state;
}
function clearErr(){ if (errEl) errEl.textContent = ""; }
function showErr(msg){ if (errEl) errEl.textContent = msg || "Giriş başarısız."; }
function humanize(err){
  const code = String(err?.code || "").toLowerCase();
  const msg  = String(err?.message || "").toLowerCase();

  if (msg.includes("admin-only"))              return "Bu panel sadece admin içindir.";
  if (code.includes("user-not-found") || code.includes("email-not-found")) return "E-posta bulunamadı.";
  if (code.includes("wrong-password"))         return "Şifre hatalı.";
  if (code.includes("invalid-credential"))     return "Bilgiler hatalı.";
  if (code.includes("operation-not-allowed"))  return "Email/Şifre girişi kapalı — Firebase Auth > Sign-in method'tan açın.";
  if (code.includes("unauthorized-domain"))    return "Alan adı yetkili değil — Auth > Authorized domains'e ekleyin.";
  if (code.includes("too-many-requests"))      return "Çok fazla deneme. Biraz bekleyin.";
  if (code.includes("network-request-failed")) return "Ağ hatası. İnternet bağlantınızı kontrol edin.";
  return "Giriş başarısız.";
}

async function isAdminUser(user){
  try{
    if (!user) return false;
    // 1) Sabit e-posta ile beyaz liste
    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
    // 2) Firestore 'users/{uid}'.role == 'admin'
    const snap = await getDoc(doc(db, "users", user.uid));
    const role = snap.exists() ? String(snap.data().role || "").toLowerCase() : "";
    return role === "admin";
  }catch{
    return false;
  }
}

function goPanel(){ location.replace("/admin/panel.html"); }

/* ------- Oturum durumu ------- */
// Zaten girişliyse: admin ise panele, değilse oturumu kapat
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (await isAdminUser(user)) {
    goPanel();
  } else {
    try { await signOut(auth); } catch {}
  }
});

/* ------- Form ile giriş ------- */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErr();
  disable(true);

  const email = (emailEl?.value || "").trim();
  const pass  = passEl?.value || "";

  try {
    // Kalıcı oturum (localStorage)
    await setPersistence(auth, browserLocalPersistence);

    // Giriş
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // Admin yetkisi kontrolü
    if (!(await isAdminUser(cred.user))) {
      await signOut(auth);
      throw new Error("admin-only");
    }

    goPanel();
  } catch (err) {
    console.error("login error:", err);
    showErr(humanize(err));
  } finally {
    disable(false);
  }
});

/* ------- (Opsiyonel) Şifre göster/gizle ------- */
showBtn?.addEventListener("click", () => {
  if (!passEl) return;
  passEl.type = passEl.type === "password" ? "text" : "password";
  showBtn.setAttribute("aria-pressed", passEl.type === "text" ? "true" : "false");
});
