// /admin/js/users.js — ÜE Admin: Kullanıcılar modülü
// mountAdminUsers({ container })

/* =========================================================
   Firebase bağlayıcı — SADECE firebase-init.js instance'ını kullan
   (versiyon çakışması yaşamamak için harici CDN'den firestore import ETME!)
   ========================================================= */

const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js'
];

// firebase-init.js => window.__fb { app, auth, db, storage, onAuthStateChanged }
// ayrıca window.firebase helper’ları ve window.getDocs veriyor.
async function ensureFirebaseReady() {
  // Önce global mevcut mu bak
  if (window.__fb?.auth && window.__fb?.db) {
    return {
      auth: window.__fb.auth,
      db: window.__fb.db,
      onAuthStateChanged:
        window.__fb.onAuthStateChanged ||
        (typeof window.onAuthStateChanged === 'function' ? window.onAuthStateChanged : null),
    };
  }

  // Değilse firebase-init.js’yi bul ve import et
  for (const p of FIREBASE_CANDIDATES) {
    try {
      const mod = await import(p + `?v=${Date.now()}`);
      const auth = mod?.auth || window.__fb?.auth;
      const db   = mod?.db   || window.__fb?.db;
      const onAuthStateChanged =
        mod?.onAuthStateChanged ||
        window.__fb?.onAuthStateChanged ||
        (typeof window.onAuthStateChanged === 'function' ? window.onAuthStateChanged : null);

      if (auth && db) return { auth, db, onAuthStateChanged };
    } catch (_) {}
  }
  throw new Error('firebase-init.js bulunamadı veya auth/db export etmiyor.');
}

// Firestore helper’ları — TAMAMI firebase-init.js’ten (tek instance)
function FF() {
  const f = window.firebase || {};
  return {
    // builder’lar
    col: f.col,
    q: f.q,
    where: f.where,
    orderBy: f.orderBy,
    limit: f.limit,
    // IO
    getDoc: f.getDoc,
    setDoc: f.setDoc,
    updateDoc: f.updateDoc,
    serverTimestamp: f.serverTimestamp,
    getDocs: window.getDocs, // firebase-init.js global verdi
  };
}

/* =========================================================
   Yardımcılar
   ========================================================= */
function esc(s) {
  return String(s ?? '').replace(/[&<>\"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
const msToDays = (ms)=> Math.max(0, Math.floor(ms/86400000));

function getMs(ts){
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}
const isPro = (u)=>{
  const t = getMs(u.proUntil ?? u.premiumUntil);
  return t > Date.now();
};
const proLeftText = (u)=>{
  const t = getMs(u.proUntil ?? u.premiumUntil);
  if (!t || t <= Date.now()) return '—';
  const d = msToDays(t - Date.now());
  return d>0 ? `AKTİF (${d}g)` : 'AKTİF (bugün)';
};

/* =========================================================
   Admin guard
   - Anonim oturum yasak
   - users/{uid}.role === 'admin' ya da (opsiyonel) claim/admin domain kontrolü
   ========================================================= */
async function ensureAdminAuth() {
  const { auth, db, onAuthStateChanged } = await ensureFirebaseReady();

  // Oturum hazır değilse bekle
  if (!auth.currentUser && typeof onAuthStateChanged === 'function') {
    await new Promise((resolve) => {
      const stop = onAuthStateChanged(auth, (u) => { if (u) { stop?.(); resolve(); } });
    });
  }

  if (!auth.currentUser) throw new Error('admin-login-required');
  if (auth.currentUser.isAnonymous) throw new Error('admin-login-required');

  // Firestore role kontrolü
  const { getDoc } = FF();
  let isAdmin = false;
  try {
    const snap = await getDoc(`users/${auth.currentUser.uid}`);
    const d = snap.exists() ? snap.data() : null;
    isAdmin = (d?.role === 'admin') || (d?.status === 'admin');
  } catch (_) {}

  // Ek olarak domain/claim izin ver (opsiyonel)
  if (!isAdmin) {
    try {
      const t = await auth.currentUser.getIdTokenResult(true);
      const email = (auth.currentUser.email||'').toLowerCase();
      const claimAdmin  = t?.claims?.admin === true;
      const domainAdmin = email.endsWith('@ureteneller.com');
      isAdmin = claimAdmin || domainAdmin;
    } catch(_) {}
  }

  if (!isAdmin) throw new Error('not-admin');
  return { auth, db };
}

/* =========================================================
   UI kurulum ve mantık
   ========================================================= */
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
  let db, auth;
  try {
    const ctx = await ensureAdminAuth();
    db = ctx.db; auth = ctx.auth;
  } catch (e) {
    const tbody = container.querySelector('#usersBody');
    const msg = e?.message === 'admin-login-required'
      ? 'Admin panel için e-posta/şifre ile giriş yapın (anonim oturum reddedildi).'
      : 'Bu bölümü görmek için admin yetkisi gerekiyor.';
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`;
    return;
  }

  // Firestore helpers (TEK instance)
  const { col, q, orderBy, limit, getDocs, setDoc, serverTimestamp } = FF();

  const usersBody = container.querySelector('#usersBody');
  const btnReload = container.querySelector('#btnReloadUsers');
  const qInput    = container.querySelector('#qUser');

  let usersCache = [];

  async function loadUsers() {
    try {
      const qRef = q(col('users'), orderBy('email'), limit(500));
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
    const qtxt = (qInput?.value || '').trim().toLowerCase();
    if (!qtxt) return render(usersCache);
    const filtered = usersCache.filter(u =>
      (u.displayName||u.name||'').toLowerCase().includes(qtxt) ||
      (u.email||'').toLowerCase().includes(qtxt) ||
      (u.city||'').toLowerCase().includes(qtxt)
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
      if (btn.dataset.action === 'pro12') {
        const until = Date.now() + 365*24*60*60*1000; // 12 ay
        await setDoc(`users/${uid}`, { proUntil: until, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].proUntil = until;
      }
      else if (btn.dataset.action === 'proOff') {
        await setDoc(`users/${uid}`, { proUntil: 0, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].proUntil = 0;
      }
      else if (btn.dataset.action === 'ban') {
        await setDoc(`users/${uid}`, { banned: true, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].banned = true;
      }
      else if (btn.dataset.action === 'unban') {
        await setDoc(`users/${uid}`, { banned: false, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(x => x.id === uid); if (i >= 0) usersCache[i].banned = false;
      }
      applyFilter();
    } catch (err) {
      console.error(err);
      alert('İşlem başarısız: ' + (err?.message || err));
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
