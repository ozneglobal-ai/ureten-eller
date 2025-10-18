// admin/js/admin-login.js
// Module script — admin login flow
// Bu dosya kökten /admin/js/admin-login.js olarak servis edilmelidir.
// <script type="module" src="/admin/js/admin-login.js" defer></script>

// --- Firebase init (kökten import) ---
import '/firebase-init.js';
import {
  getAuth, setPersistence, browserLocalPersistence,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

const auth = getAuth();
const $ = (s)=>document.querySelector(s);
const form = $('#loginForm');
const emailEl = $('#email');
const passEl  = $('#password');
const errEl   = $('#err');

function showErr(msg){ if(errEl){ errEl.textContent = msg || ''; } }
function disableForm(dis){
  if(!form) return;
  const btn = form.querySelector('button[type="submit"]');
  if(btn) btn.disabled = !!dis;
}

// Zaten girişliyse ve admin ise direkt panele al
onAuthStateChanged(auth, async (u)=>{
  if(!u) return;
  try{
    const t = await u.getIdTokenResult(true);
    const email = (u.email||'').toLowerCase();
    const ok = t?.claims?.admin === true || email.endsWith('@ureteneller.com');
    if(ok){
      location.replace('/admin/panel.html');
    }else{
      // login oldu ama admin değilse çıkışa zorla
      await signOut(auth);
      showErr('Bu hesap için admin izni bulunmuyor.');
    }
  }catch{
    // bir şey olursa sessiz geç
  }
});

// Form gönderimi
form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  showErr('');
  const email = (emailEl?.value||'').trim();
  const pass  = (passEl?.value||'').trim();
  if(!email || !pass){ showErr('E-posta ve şifre gerekli'); return; }

  try{
    disableForm(true);
    await setPersistence(auth, browserLocalPersistence); // kalıcı oturum
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged içinde panel.html'e yönlenecek
  }catch(err){
    // Hata mesajlarını kullanıcı dostu ver
    const code = err?.code || '';
    if(code.includes('user-not-found'))      showErr('Kullanıcı bulunamadı');
    else if(code.includes('wrong-password')) showErr('Şifre hatalı');
    else if(code.includes('too-many-requests')) showErr('Çok fazla deneme, lütfen sonra tekrar deneyin');
    else showErr('Giriş başarısız: '+(err?.message||''));
  }finally{
    disableForm(false);
  }
});

// Koruma: HTML öğeleri yoksa uyarı düş (geliştirme için)
if(!form){
  console.warn('[admin-login] #loginForm bulunamadı. admin/index.html içinde doğru id değerlerini kullandığınızdan emin olun.');
}
