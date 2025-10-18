// admin/js/admin-login.js — DROP‑IN FIX
// Bu sürüm, /firebase-init.js'ten named export beklemez.
// window.__fb.auth hazır olana kadar bekler ve Firebase Auth'u CDN'den kullanır.

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

// ---- Ayarlar ----
const ADMIN_EMAIL = 'ozneglobal@gmail.com'; // gerekirse değiştirin

// ---- Yardımcılar ----
const $ = (s) => document.querySelector(s);
function disable(state){
  const submit = $('#loginForm button[type="submit"]');
  const emailEl = $('#email');
  const passEl  = $('#password');
  if (submit) submit.disabled = state;
  if (emailEl) emailEl.disabled = state;
  if (passEl)  passEl.disabled  = state;
}
function clearErr(){ const n = $('#err'); if (n) n.textContent = ''; }
function showErr(msg){ const n = $('#err'); if (n) n.textContent = msg || 'Giriş başarısız.'; }
function humanize(err){
  const code = (err?.code || '').toLowerCase();
  const msg  = (err?.message || '').toLowerCase();
  if (msg.includes('admin-only'))             return 'Bu panel sadece admin içindir.';
  if (code.includes('user-not-found'))        return 'E‑posta bulunamadı.';
  if (code.includes('wrong-password'))        return 'Şifre hatalı.';
  if (code.includes('invalid-credential'))    return 'Bilgiler hatalı.';
  if (code.includes('too-many-requests'))     return 'Çok deneme yapıldı. Biraz bekleyin.';
  if (code.includes('network-request-failed'))return 'Ağ hatası. Bağlantınızı kontrol edin.';
  if (code.includes('popup-closed-by-user'))  return 'İşlem iptal edildi.';
  return 'Giriş başarısız.';
}

// firebase-init.js hazır mı? (window.__fb.auth)
async function waitForAuth(maxMs = 8000){
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    (function tick(){
      const fb = window.__fb;
      if (fb && fb.auth) return resolve(fb.auth);
      if (Date.now() - t0 > maxMs) return reject(new Error('Firebase init bulunamadı'));
      setTimeout(tick, 50);
    })();
  });
}

async function boot(){
  let auth;
  try{ auth = await waitForAuth(); }
  catch(e){ console.error(e); showErr('Firebase başlatılamadı'); return; }

  try{ await setPersistence(auth, browserLocalPersistence); }catch(e){ /* non‑fatal */ }

  // Zaten girişliyse kontrol et → admin ise panele, değilse çıkış
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    if ((user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      location.replace('./panel.html');
    } else {
      try { await signOut(auth); } catch {}
      showErr('Bu panel sadece admin içindir.');
    }
  });

  // Form submit
  const form = $('#loginForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErr();
      disable(true);
      const email = ($('#email')?.value || '').trim();
      const pass  = $('#password')?.value || '';
      try{
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const ok = (cred.user?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (!ok) {
          await signOut(auth);
          const err = new Error('admin-only');
          err.code = 'auth/admin-only';
          throw err;
        }
        location.replace('./panel.html');
      }catch(err){ showErr(humanize(err)); }
      finally{ disable(false); }
    });
  }

  // (Opsiyonel) Şifre göster/gizle
  const toggle = $('#togglePassword');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const passEl = $('#password');
      if (!passEl) return;
      passEl.type = passEl.type === 'password' ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', passEl.type === 'text' ? 'true' : 'false');
    });
  }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
