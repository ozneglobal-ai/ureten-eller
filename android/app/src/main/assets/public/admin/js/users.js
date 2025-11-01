// /admin/admin/js/users.js — ÜE Admin: Kullanıcılar modülü
// mountAdminUsers({ container })

// ---- Firebase modülünü bulmak için olası yollar
const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js'
];

// ---- Firebase (auth+db) yükleyici
async function getFirebase() {
  for (const p of FIREBASE_CANDIDATES) {
    try {
      const mod = await import(p + `?v=${Date.now()}`);
      if (mod?.db && mod?.auth) {
        // onAuthStateChanged export edilmemiş olabilir → window.__fb'den de deneriz
        const onAuthStateChanged =
          mod.onAuthStateChanged ||
          (typeof window !== 'undefined' && window.__fb && window.__fb.onAuthStateChanged) ||
          null;
        return { db: mod.db, auth: mod.auth, onAuthStateChanged };
      }
    } catch (_) {}
  }
  throw new Error('firebase-init.js bulunamadı veya db/auth export etmiyor');
}

// ---- Firestore helper’ları (tek sefer cache)
let FF = null;
async function getFF() {
  if (FF) return FF;
  FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  return FF;
}

// ---- Yardımcılar
function esc(s) {
  return String(s ?? '').replace(/[&<>\"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
const msToDays = (ms)=> Math.max(0, Math.floor(ms/86400000));
const isPro = (u)=>{
  const ts = u.proUntil ?? u.premiumUntil;
  const t = typeof ts==='number' ? ts : (ts?.seconds ? ts.seconds*1000 : 0);
  return t > Date.now();
};
const proLeftText = (u)=>{
  const ts = u.proUntil ?? u.premiumUntil;
  const t = typeof ts==='number' ? ts : (ts?.seconds ? ts.seconds*1000 : 0);
  if (!t || t <= Date.now()) return '—';
  const d = msToDays(t - Date.now());
  return d>0 ? `AKTİF (${d}g)` : 'AKTİF (bugün)';
};

// ---- Admin guard: anonim hesapları reddet, role:'admin' şartı
async function ensureAdminAuth() {
  const fb = await getFirebase();
  const { db, auth, onAuthStateChanged } = fb;

  // Oturum hazır değilse abone ol veya kısa polling
  if (!auth.currentUser) {
    if (typeof onAuthStateChanged === 'function') {
      await new Promise((resolve) => {
        const stop = onAuthStateChanged(auth, (u) => { if (u) { stop?.(); resolve(); } });
      });
    }
  }

  if (!auth.currentUser) {
    throw new Error('admin-login-required');
  }
  if (auth.currentUser.isAnonymous) {
    throw new Error('admin-login-required'); // admin panelde anonim yasak
  }

  // users/{uid}.role === 'admin' kontrolü
  const { doc, getDoc } = await getFF();
  let isAdmin = false;
  try {
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    isAdmin = snap.exists() && (snap.data().role === 'admin');
  } catch {}
  if (!isAdmin) throw new Error('not-admin');

  return { db, auth };
}

// ---- ANA: mount
export async function mountAdminUsers({ container }) {
  if (!container) throw new Error('mountAdminUsers: container yok');

  // UI iskeleti
  container.innerHTML = `
    <div class="row">
      <h2 style="margin-right:auto">Kullanıcı Yönetimi</h2>
      <input id="qUser" class="input" type="text" placeholder="Ad / e-posta / şehir" />
      <button id="btnReloadUsers" class="btn-sm">Yenile</button>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>E-posta</th>
            <th>Rol</th>
            <th>Şehir</th>
            <th>PRO</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="usersBody">
          <tr><td colspan="6" class="muted">Yükleniyor…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Admin yetkilendirme
  let db;
  try {
    const ctx = await ensureAdminAuth();
    db = ctx.db;
  } catch (e) {
    const tbody = container.querySelector('#usersBody');
    const msg = e?.message === 'admin-login-required'
      ? 'Admin panel için e-posta/şifre ile giriş yapın (anonim oturum reddedildi).'
      : 'Bu bölümü görmek için admin yetkisi gerekiyor.';
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`;
    return;
  }

  // Firestore helpers
  const { collection, doc, getDocs, setDoc, query, orderBy, limit, serverTimestamp } = await getFF();

  const usersBody = container.querySelector('#usersBody');
  const btnReload = container.querySelector('#btnReloadUsers');
  const qInput    = container.querySelector('#qUser');

  let usersCache = [];

  async function loadUsers() {
    try {
      // email sırasına göre max 500 kayıt
      const qRef = query(collection(db,'users'), orderBy('email'), limit(500));
      const snap = await getDocs(qRef);
      usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render(usersCache);
    } catch (err) {
      console.error(err);
      usersBody.innerHTML = `<tr><td colspan="6" class="muted">Yüklenemedi</td></tr>`;
    }
  }

  function render(list) {
    usersBody.innerHTML = list.length ? '' : `<tr><td colspan="6" class="muted">Kayıt yok</td></tr>`;
    for (const u of list) {
      const name  = u.displayName || u.name || '—';
      const email = u.email || '—';
      const role  = u.role || '—';
      const city  = u.city || '—';
      const proActive = isPro(u);
      const proTxt = proLeftText(u);
      const mainBtnLabel  = proActive ? 'PRO ÜYE' : 'PRO VER';
      const mainBtnAction = proActive ? 'proOff' : 'pro12';
      const banned = !!u.banned;

      usersBody.insertAdjacentHTML('beforeend', `
        <tr data-uid="${esc(u.id)}">
          <td><a class="user-link" href="/profile.html?uid=${encodeURIComponent(u.id)}" target="_blank">${esc(name)}</a></td>
          <td>${esc(email)}</td>
          <td>${esc(role)}</td>
          <td>${esc(city)}</td>
          <td data-proleft>${proTxt}</td>
          <td class="actions">
            <button class="btn-sm" data-action="${mainBtnAction}">${mainBtnLabel}</button>
            ${banned
              ? `<button class="btn-sm" data-action="unban">Ban Kaldır</button>`
              : `<button class="btn-sm danger" data-action="ban">Banla</button>`}
          </td>
        </tr>
      `);
    }
  }

  function applyFilter() {
    const q = (qInput?.value || '').trim().toLowerCase();
    if (!q) return render(usersCache);
    const filtered = usersCache.filter(u =>
      (u.displayName||u.name||'').toLowerCase().includes(q) ||
      (u.email||'').toLowerCase().includes(q) ||
      (u.city||'').toLowerCase().includes(q)
    );
    render(filtered);
  }

  async function handleAction(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const tr  = btn.closest('tr[data-uid]');
    const uid = tr?.dataset.uid;
    if (!uid) return;

    btn.disabled = true;
    try {
      // Admin olarak yazıyoruz (kurallar admin’e serbest)
      if (btn.dataset.action === 'pro12') {
        const until = Date.now() + 365*24*60*60*1000; // 12 ay
        await setDoc(doc(db,'users',uid), { proUntil: until, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].proUntil = until;
      }
      else if (btn.dataset.action === 'proOff') {
        await setDoc(doc(db,'users',uid), { proUntil: 0, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].proUntil = 0;
      }
      if (btn.dataset.action === 'pro12') {
  const until = Date.now() + 365*24*60*60*1000; // 12 ay
  await setDoc(doc(db,'users',uid), {
    proUntil: until,
    isVerified: true, // ✅ Premium verildiğinde otomatik onayla
    updatedAt: serverTimestamp()
  }, { merge:true });
  const i = usersCache.findIndex(x => x.id === uid);
  if (i >= 0) {
    usersCache[i].proUntil = until;
    usersCache[i].isVerified = true; // frontend cache'i de güncelle
  }
}
      else if (btn.dataset.action === 'unban') {
        await setDoc(doc(db,'users',uid), { banned: false, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].banned = false;
      }
      applyFilter();
    } catch (err) {
      console.error(err);
      alert('İşlem başarısız: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // events
  btnReload?.addEventListener('click', loadUsers);
  qInput?.addEventListener('input', applyFilter);
  container.addEventListener('click', handleAction);

  // go
  await loadUsers();
}

// (opsiyonel) default export
export default { mountAdminUsers };
