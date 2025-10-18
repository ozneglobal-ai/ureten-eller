// /admin/js/listings.js — ÜE Admin: İlanlar modülü
// mountAdminListings({ container })

/* =========================================================
   Firebase bağlayıcı — SADECE firebase-init.js instance'ını kullan
   (versiyon çakışması olmaması için CDN'den firestore import ETME!)
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
  // Global varsa direkt kullan
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
   Basit yardımcılar
   ========================================================= */
function esc(s) {
  return String(s ?? '').replace(/[&<>\"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
const DAY = 86400000;
const LIFE_DAYS = 30;
function getMs(ts){
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && typeof ts.seconds === 'number') return ts.seconds*1000;
  return 0;
}
function fmtTRY(v) {
  try {
    return new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(Number(v||0));
  } catch { return (v||0)+' TL'; }
}
function badge(l) {
  const tags = [];
  const status = l.status || 'pending';
  if (status === 'pending') tags.push('Bekliyor');
  if (status === 'approved') {
    const left = l.expiresAt ? Math.max(0, Math.ceil((getMs(l.expiresAt) - Date.now())/DAY)) : LIFE_DAYS;
    tags.push(`${left} gün`);
    if (l.showcase) tags.push('⭐ Vitrin');
    if (l.showcasePending) tags.push('Onay bekliyor');
  }
  if (status === 'expired') tags.push('Süre doldu');
  if (status === 'rejected') tags.push('Reddedildi');
  return tags.join(' • ');
}

/* =========================================================
   Admin guard
   - Anonim oturum yasak
   - users/{uid}.role === 'admin' ya da (opsiyonel) claim/domain
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

  // Ek: custom claim / domain
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
   ANA: mount
   ========================================================= */
export async function mountAdminListings({ container }) {
  if (!container) throw new Error('mountAdminListings: container yok');

  // UI iskeleti
  container.innerHTML = `
    <div class="row">
      <h2 style="margin-right:auto">İlan Yönetimi</h2>
      <div class="row-right">
        <select id="listingFilter" class="input">
          <option value="pending">Bekleyen</option>
          <option value="approved">Onaylı</option>
          <option value="rejected">Red</option>
          <option value="expired">Süresi Dolan</option>
          <option value="deleted">Silinen</option>
          <option value="all">Tümü</option>
        </select>
        <input id="qListing" class="input" placeholder="Başlık / satıcı / ID"/>
        <button id="btnReloadListings" class="btn-sm">Yenile</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Başlık</th>
            <th>Satıcı</th>
            <th>Fiyat</th>
            <th>Durum</th>
            <th>Vitrin</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody id="listingsBody">
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
    const tbody = container.querySelector('#listingsBody');
    const msg = e?.message === 'admin-login-required'
      ? 'Admin panel için e-posta/şifre ile giriş yapın (anonim oturum reddedildi).'
      : 'Bu bölümü görmek için admin yetkisi gerekiyor.';
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`;
    return;
  }

  // Firestore helpers (TEK instance)
  const { col, q, orderBy, limit, getDocs, setDoc, serverTimestamp } = FF();

  // DOM
  const tbody     = container.querySelector('#listingsBody');
  const selStatus = container.querySelector('#listingFilter');
  const qInput    = container.querySelector('#qListing');
  const btnReload = container.querySelector('#btnReloadListings');

  let cache = []; // {id, ...}

  async function load() {
    try {
      // createdAt üzerinden en yeni 500
      const qRef = q(col('listings'), orderBy('createdAt', 'desc'), limit(500));
      const snap = await getDocs(qRef);
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      paint();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Yüklenemedi</td></tr>`;
    }
  }

  function currentFilter(list) {
    const st = selStatus?.value || 'pending';
    let arr = st === 'all' ? list : list.filter(l => (l.status || 'pending') === st);

    const qtxt = (qInput?.value || '').trim().toLowerCase();
    if (qtxt) {
      arr = arr.filter(l =>
        (l.title || '').toLowerCase().includes(qtxt) ||
        (l.sellerName || '').toLowerCase().includes(qtxt) ||
        (l.sellerId || '').toLowerCase().includes(qtxt) ||
        (l.id || '').toLowerCase().includes(qtxt)
      );
    }
    return arr;
  }

  function paint() {
    const data = currentFilter(cache);
    tbody.innerHTML = data.length ? '' : `<tr><td colspan="6" class="muted">Kayıt yok</td></tr>`;
    for (const l of data) {
      const price = fmtTRY(l.price);
      const status = l.status || '—';
      tbody.insertAdjacentHTML('beforeend', `
        <tr data-id="${esc(l.id)}">
          <td>${esc(l.title || '—')}</td>
          <td>${esc(l.sellerName || l.sellerId || '—')}</td>
          <td>${price}</td>
          <td>${esc(status)}</td>
          <td>${badge(l) || '—'}</td>
          <td class="actions">
            ${status==='pending'  ? '<button class="btn-sm" data-act="approve">Onayla</button> <button class="btn-sm danger" data-act="reject">Reddet</button>' : ''}
            ${status==='approved' ? '<button class="btn-sm" data-act="renew">Süreyi Yenile</button>' : ''}
            ${status==='expired'  ? '<button class="btn-sm" data-act="republish">Yeniden Yayınla</button>' : ''}
            ${status==='rejected' ? '<button class="btn-sm" data-act="fix">Düzelt & Yeniden Gönder</button>' : ''}
            ${!l.showcase && status==='approved' ? '<button class="btn-sm" data-act="showcase">Vitrine Öner</button>' : ''}
            ${l.showcase ? '<button class="btn-sm" data-act="unshowcase">Vitrinden Kaldır</button>' : ''}
            <button class="btn-sm danger" data-act="delete">Sil</button>
          </td>
        </tr>
      `);
    }
  }

  // İşlemler
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const tr  = btn.closest('tr[data-id]'); const id = tr?.dataset.id; if (!id) return;

    btn.disabled = true;
    try {
      const i = cache.findIndex(x => x.id === id); if (i < 0) return;
      const l = cache[i];
      const patch = {};
      const now = Date.now();

      switch (btn.dataset.act) {
        case 'approve':
          patch.status = 'approved';
          patch.expiresAt = now + LIFE_DAYS * DAY;
          break;
        case 'reject':
          patch.status = 'rejected';
          patch.showcase = false;
          patch.showcasePending = false;
          break;
        case 'renew':
          patch.expiresAt = now + LIFE_DAYS * DAY;
          break;
        case 'republish':
        case 'fix':
          patch.status = 'pending';
          break;
        case 'showcase':
          patch.showcasePending = true;
          break;
        case 'unshowcase':
          patch.showcase = false;
          patch.showcasePending = false;
          break;
        case 'delete':
          // Kurallar "deleted" durumuna izin vermiyor → soft delete: rejected
          patch.status = 'rejected';
          patch.showcase = false;
          patch.showcasePending = false;
          break;
      }

      // Kuralların izin verdiği alanlar:
      // title, price, status, photo, expiresAt, showcase, showcasePending, updatedAt
      const { setDoc, serverTimestamp } = FF();
      await setDoc(`listings/${id}`, { ...patch, updatedAt: serverTimestamp() }, { merge: true });

      Object.assign(cache[i], patch);
      paint();
    } catch (err) {
      console.error(err);
      alert('İşlem başarısız: ' + (err?.message || err));
    } finally {
      btn.disabled = false;
    }
  });

  selStatus?.addEventListener('change', paint);
  qInput?.addEventListener('input', paint);
  btnReload?.addEventListener('click', load);

  // Go
  await load();
}

// default export (opsiyonel)
export default { mountAdminListings };
