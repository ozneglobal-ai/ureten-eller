// admin-login.js
import { auth } from "/firebase-init.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const ADMIN_EMAIL = "ozneglobal@gmail.com";

const form    = document.getElementById("loginForm");
const errEl   = document.getElementById("err");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const submit  = form?.querySelector('button[type="submit"]');
const showBtn = document.getElementById("togglePassword"); // (opsiyonel: varsa kullanır)

// Zaten girişliyse kontrol et → admin ise panele, değilse oturumu kapat
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (user.email === ADMIN_EMAIL) {
    location.replace("./panel.html");
  } else {
    try { await signOut(auth); } catch {}
  }
});

// Form ile giriş
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErr();
  disable(true);

  const email = (emailEl?.value || "").trim();
  const pass  = passEl?.value || "";

  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    if (cred.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      throw new Error("admin-only");
    }

    location.replace("./panel.html");
  } catch (err) {
    showErr(humanize(err));
  } finally {
    disable(false);
  }
});

// (Opsiyonel) Şifreyi göster/gizle butonu varsa
showBtn?.addEventListener("click", () => {
  if (!passEl) return;
  passEl.type = passEl.type === "password" ? "text" : "password";
  showBtn.setAttribute("aria-pressed", passEl.type === "text" ? "true" : "false");
});

// Yardımcılar
function disable(state){
  if (submit) submit.disabled = state;
  if (emailEl) emailEl.disabled = state;
  if (passEl)  passEl.disabled  = state;
}

function clearErr(){ if (errEl) errEl.textContent = ""; }

function showErr(msg){
  if (!errEl) return;
  errEl.textContent = msg || "Giriş başarısız.";
}

function humanize(err){
  const code = (err?.code || "").toLowerCase();
  const msg  = (err?.message || "").toLowerCase();

  if (msg.includes("admin-only"))           return "Bu panel sadece admin içindir.";
  if (code.includes("user-not-found"))      return "E-posta bulunamadı.";
  if (code.includes("wrong-password"))      return "Şifre hatalı.";
  if (code.includes("invalid-credential"))  return "Bilgiler hatalı.";
  if (code.includes("too-many-requests"))   return "Çok sayıda deneme yapıldı. Lütfen daha sonra tekrar deneyin.";
  if (code.includes("network-request-failed")) return "Ağ hatası. Bağlantınızı kontrol edin.";
  if (code.includes("popup-closed-by-user"))   return "İşlem iptal edildi.";

  return "Giriş başarısız.";
}
