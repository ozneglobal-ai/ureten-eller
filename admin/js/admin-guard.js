<script type="module">
// /admin/js/admin-guard.js
import '/firebase-init.js';
import {
  getAuth, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

const auth = window.__fb?.auth || getAuth();

// tekrar tetiklenmeyi engelle
if (!window.__ADMIN_GUARD_INSTALLED) {
  window.__ADMIN_GUARD_INSTALLED = true;

  function isAdminToken(t, email){
  const claim = t?.claims?.admin === true;
  const domain = (email||'').toLowerCase().endsWith('@ureteneller.com');
  const allowlist = ['ozneglobal@gmail.com']; // manuel izinli mailler
  return claim || domain || allowlist.includes((email||'').toLowerCase());
}

  onAuthStateChanged(auth, async (u)=>{
    // hiç kullanıcı yoksa girişe gönder
    if (!u) {
      location.replace('/admin/index.html');
      return;
    }
    try {
      const token = await u.getIdTokenResult(true);
      if (isAdminToken(token, u.email)) {
        // adminse panelde kal
        return;
      }
      // admin değil: çıkış + giriş sayfası
      try { await signOut(auth); } catch {}
      location.replace('/admin/index.html');
    } catch (e) {
      // emin olamıyorsak güvenli tarafta kalalım
      try { await signOut(auth); } catch {}
      location.replace('/admin/index.html');
    }
  });
}
</script>
