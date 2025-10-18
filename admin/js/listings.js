// /admin/js/listings.js — ÜE Admin: İlanlar modülü (detay + satıcı bilgisi + aksiyonlar)

const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js'
];

async function getFirebase() {
  // Önce global
  if (window.__fb?.db && window.__fb?.auth) {
    return { db: window.__fb.db, auth: window.__fb.auth, onAuthStateChanged: window.__fb.onAuthStateChanged };
  }
  // Değilse init dosyasını ara
  for (const p of FIREBASE_CANDIDATES) {
    try {
      const mod = await import(p + `?v=${Date.now()}`);
      const auth = mod?.auth || window.__fb?.auth;
      const db   = mod?.db   || window.__fb?.db;
      const onAuthStateChanged = mod?.onAuthStateChanged || window.__fb?.onAuthStateChanged || null;
      if (auth && db) return { db, auth, onAuthStateChanged };
    } catch(_) {}
  }
  throw new Error('firebase-init.js bulunamadı veya db/auth export etmiyor');
}

let FF = null;
async function getFF() {
  if (FF) return FF;
  FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  return FF;
}

function esc(s){ return String(s ?? '').replace(/[&<>\"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
const DAY=86400000, LIFE_DAYS=30;
function fmtTRY(v){ try{ return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v||0)); }catch{ return (v||0)+' TL'; } }
function badge(l){
  const tags=[];
  const st = l.status || 'pending';
  if (st==='pending') tags.push('Bekliyor');
  if (st==='approved') {
    const left = l.expiresAt ? Math.max(0, Math.ceil((l.expiresAt - Date.now())/DAY)) : LIFE_DAYS;
    tags.push(`${left} gün`);
    if (l.showcase) tags.push('⭐ Vitrin');
    if (l.showcasePending) tags.push('Onay bekliyor');
  }
  if (st==='expired') tags.push('Süre doldu');
  if (st==='rejected') tags.push('Reddedildi');
  return tags.join(' • ');
}

// --- admin guard (sadece Firestore rolüne bak, net hata mesajı üret)
async function ensureAdminAuth(){
  // 1) init’i mutlaka yükle (window.__fb de kabul)
  let db, auth, onAuthStateChanged;
  try {
    const fb = await getFirebase();
    db = fb.db; auth = fb.auth; onAuthStateChanged = fb.onAuthStateChanged;
  } catch(e){
    console.error('[admin] firebase-init yüklenemedi:', e);
    throw new Error('admin-login-required');
  }

  // 2) Oturum hazır olana kadar bekle
  if (!auth.currentUser && typeof onAuthStateChanged === 'function'){
    await new Promise(res=>{
      const stop = onAuthStateChanged(auth, (u)=>{ if(u){ stop?.(); res(); } });
    });
  }
  if (!auth.currentUser) throw new Error('admin-login-required');
  if (auth.currentUser.isAnonymous) throw new Error('admin-login-required');

  // 3) Sadece Firestore rolüne bak (en güvenilir & deterministik)
  const { doc, getDoc } = await getFF();
  let isAdmin = false, reason = '';
  try{
    const snap = await getDoc(doc(db,'users',auth.currentUser.uid));
    if (snap.exists()){
      const r = (snap.data().role || '').toString().toLowerCase();
      isAdmin = (r === 'admin');
      if (!isAdmin) reason = `users/${auth.currentUser.uid}.role = "${r}"`;
    } else {
      reason = 'users/{uid} dokümanı yok';
    }
  }catch(err){
    console.error('[admin] role read error:', err);
    reason = 'roles-read-failed';
  }

  if (!isAdmin){
    // İstersen tut: console.warn ile nedenini açık yaz
    console.warn('[admin] not-admin →', reason);
    throw new Error('not-admin');
  }
  return { db, auth };
}

// === Detay paneli (tek sefer oluştur)
function ensureDetailHost(){
  if (document.getElementById('listingDetailHost')) return;
  const host = document.createElement('div');
  host.id='listingDetailHost';
  host.innerHTML = `
    <div id="ldBackdrop" style="position:fixed;inset:0;background:#0009;backdrop-filter:blur(2px);display:none;z-index:9998"></div>
    <div id="ldPanel" style="position:fixed;right:0;top:0;bottom:0;width:min(720px,96vw);background:#0b1220;color:#e5e7eb;border-left:1px solid #1f2937;box-shadow:0 0 40px #000a;transform:translateX(100%);transition:transform .2s ease;z-index:9999;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem;border-bottom:1px solid #1f2937">
        <strong style="font-size:18px">İlan Detayı</strong>
        <button id="ldClose" class="btn-sm" style="margin-left:auto;background:#111">Kapat</button>
      </div>
      <div id="ldBody" style="padding:.8rem;overflow:auto;display:grid;gap:.75rem"></div>
    </div>
  `;
  document.body.appendChild(host);
  const bd = host.querySelector('#ldBackdrop');
  const pn = host.querySelector('#ldPanel');
  const close = ()=>{ pn.style.transform='translateX(100%)'; bd.style.display='none'; };
  host.querySelector('#ldClose').onclick = close;
  bd.onclick = close;
}
function openDetail(){ const bd=document.getElementById('ldBackdrop'); const pn=document.getElementById('ldPanel'); if(!bd||!pn) return; bd.style.display='block'; pn.style.transform='translateX(0)'; }
function closeDetail(){ const bd=document.getElementById('ldBackdrop'); const pn=document.getElementById('ldPanel'); if(!bd||!pn) return; pn.style.transform='translateX(100%)'; bd.style.display='none'; }

// === ANA
export async function mountAdminListings({ container }) {
  if (!container) throw new Error('mountAdminListings: container yok');

  // UI
  container.innerHTML = `
    <div class="row">
      <h2 style="margin-right:auto">İlan Yönetimi</h2>
      <div class="row-right">
        <select id="listingFilter" class="input">
          <option value="pending">Bekleyen</option>
          <option value="approved">Onaylı</option>
          <option value="rejected">Red</option>
          <option value="expired">Süresi Dolan</option>
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

  // Guard
  let db, auth;
  try { ({ db, auth } = await ensureAdminAuth()); }
  catch(e){
    const tbody = container.querySelector('#listingsBody');
    const msg = e?.message==='admin-login-required'
      ? 'Admin panel için e-posta/şifre ile giriş yapın (anonim oturum reddedildi).'
      : 'Bu bölümü görmek için admin yetkisi gerekiyor.';
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`;
    return;
  }

  const { collection, doc, getDocs, getDoc, setDoc, query, orderBy, limit, serverTimestamp } = await getFF();

  // DOM
  const tbody     = container.querySelector('#listingsBody');
  const selStatus = container.querySelector('#listingFilter');
  const qInput    = container.querySelector('#qListing');
  const btnReload = container.querySelector('#btnReloadListings');

  ensureDetailHost();

  let cache = []; // {id, ...}

  // satıcı adını getir
  async function getSellerMeta(sellerId){
    if (!sellerId) return { name:'—', email:'—' };
    try{
      const s = await getDoc(doc(db,'users',sellerId));
      if (!s.exists()) return { name: '—', email: '—' };
      const d = s.data();
      return { name: d.displayName || d.name || '—', email: d.email || '—' };
    }catch{ return { name:'—', email:'—' }; }
  }

  async function load(){
    try{
      const qRef = query(collection(db,'listings'), orderBy('createdAt','desc'), limit(500));
      const snap = await getDocs(qRef);
      cache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      paint();
    }catch(err){
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Yüklenemedi</td></tr>`;
    }
  }

  function currentFilter(list){
    const st = selStatus?.value || 'pending';
    let arr = st==='all' ? list : list.filter(l => (l.status||'pending')===st);
    const q = (qInput?.value||'').trim().toLowerCase();
    if (q){
      arr = arr.filter(l =>
        (l.title||'').toLowerCase().includes(q) ||
        (l.sellerName||'').toLowerCase().includes(q) ||
        (l.sellerId||'').toLowerCase().includes(q) ||
        (l.id||'').toLowerCase().includes(q)
      );
    }
    return arr;
  }

  async function paint(){
    const data = currentFilter(cache);
    tbody.innerHTML = data.length ? '' : `<tr><td colspan="6" class="muted">Kayıt yok</td></tr>`;
    for (const l of data){
      // satıcı adı anlık yoksa '—' gösteriyoruz; detayda kesin getireceğiz
      const seller = l.sellerName || l.sellerId || '—';
      const price  = fmtTRY(l.price);
      const tr = document.createElement('tr');
      tr.dataset.id = l.id;
      tr.innerHTML = `
        <td class="td-title"><a href="#" data-open="${esc(l.id)}">${esc(l.title||'—')}</a></td>
        <td>${esc(seller)}</td>
        <td>${price}</td>
        <td>${esc(l.status||'—')}</td>
        <td>${badge(l) || '—'}</td>
        <td class="actions">
          ${l.status==='pending'  ? '<button class="btn-sm" data-act="approve">Onayla</button> <button class="btn-sm danger" data-act="reject">Reddet</button>' : ''}
          ${l.status==='approved' ? '<button class="btn-sm" data-act="renew">Süreyi Yenile</button>' : ''}
          ${l.status==='expired'  ? '<button class="btn-sm" data-act="republish">Yeniden Yayınla</button>' : ''}
          ${l.status==='rejected' ? '<button class="btn-sm" data-act="fix">Düzelt & Yeniden Gönder</button>' : ''}
          ${!l.showcase && l.status==='approved' ? '<button class="btn-sm" data-act="showcase">Vitrine Öner</button>' : ''}
          ${l.showcase ? '<button class="btn-sm" data-act="unshowcase">Vitrinden Kaldır</button>' : ''}
          <button class="btn-sm danger" data-act="delete">Sil</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  // Detay panelini doldur
  async function openListingDetail(id){
    const item = cache.find(x=>x.id===id);
    if (!item) return;
    const seller = await getSellerMeta(item.sellerId);

    const photos = Array.isArray(item.photos) ? item.photos : (item.photo ? [item.photo] : []);
    const imgs = photos.length
      ? photos.map(u=>`<div style="aspect-ratio:1/1;background:#0e172a url('${esc(u)}') center/cover;border:1px solid #1f2937;border-radius:12px"></div>`).join('')
      : '<div class="muted">Fotoğraf yok</div>';

    const body = document.getElementById('ldBody');
    body.innerHTML = `
      <div style="display:grid;gap:.75rem">
        <div>
          <div class="muted">İlan ID</div>
          <div style="font-family:ui-monospace,Consolas">${esc(id)}</div>
        </div>

        <div style="display:grid;gap:.5rem;grid-template-columns:repeat(3,minmax(0,1fr))">${imgs}</div>

        <div style="display:grid;gap:.5rem;grid-template-columns:repeat(2,minmax(0,1fr))">
          <div><div class="muted">Başlık</div><div><strong>${esc(item.title||'—')}</strong></div></div>
          <div><div class="muted">Fiyat</div><div>${fmtTRY(item.price)}</div></div>
          <div><div class="muted">Durum</div><div>${esc(item.status||'—')}</div></div>
          <div><div class="muted">Vitrin</div><div>${item.showcase?'Evet':'Hayır'} ${item.showcasePending?'(Onay bekliyor)':''}</div></div>
        </div>

        <div>
          <div class="muted">Açıklama</div>
          <div style="white-space:pre-wrap">${esc(item.description||'—')}</div>
        </div>

        <div style="display:grid;gap:.5rem;grid-template-columns:repeat(2,minmax(0,1fr))">
          <div>
            <div class="muted">Satıcı Adı</div>
            <div>${esc(seller.name)}</div>
          </div>
          <div>
            <div class="muted">Satıcı E-posta</div>
            <div>${esc(seller.email)}</div>
          </div>
        </div>

        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.25rem">
          ${item.status==='pending'  ? '<button class="btn-sm" data-act="approve" data-id="'+esc(id)+'">Onayla</button><button class="btn-sm danger" data-act="reject" data-id="'+esc(id)+'">Reddet</button>' : ''}
          ${item.status==='approved' ? '<button class="btn-sm" data-act="renew" data-id="'+esc(id)+'">Süreyi Yenile</button>' : ''}
          ${item.status==='expired'  ? '<button class="btn-sm" data-act="republish" data-id="'+esc(id)+'">Yeniden Yayınla</button>' : ''}
          ${item.status==='rejected' ? '<button class="btn-sm" data-act="fix" data-id="'+esc(id)+'">Düzelt & Yeniden Gönder</button>' : ''}
          ${!item.showcase && item.status==='approved' ? '<button class="btn-sm" data-act="showcase" data-id="'+esc(id)+'">Vitrine Öner</button>' : ''}
          ${item.showcase ? '<button class="btn-sm" data-act="unshowcase" data-id="'+esc(id)+'">Vitrinden Kaldır</button>' : ''}
          <button class="btn-sm danger" data-act="delete" data-id="${esc(id)}">Sil</button>
          <a class="btn-sm" target="_blank" href="/listing.html?id=${encodeURIComponent(id)}">Kullanıcı Görünümü</a>
        </div>
      </div>
    `;

    openDetail();
  }

  // Tabloda tıklama: başlığa basınca detay
  tbody.addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-open]');
    if (!a) return;
    e.preventDefault();
    openListingDetail(a.getAttribute('data-open'));
  });

  // İşlemler (tablo ve panel ortak)
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-act]'); if(!btn) return;
    const id  = btn.getAttribute('data-id') || btn.closest('tr')?.dataset.id;
    if (!id) return;

    btn.disabled = true;
    try{
      const i = cache.findIndex(x => x.id === id); if (i < 0) return;
      const l = cache[i];
      const patch = {};
      const now = Date.now();

      switch (btn.dataset.act) {
        case 'approve':   patch.status='approved'; patch.expiresAt = now + LIFE_DAYS*DAY; break;
        case 'reject':    patch.status='rejected'; patch.showcase=false; patch.showcasePending=false; break;
        case 'renew':     patch.expiresAt = now + LIFE_DAYS*DAY; break;
        case 'republish':
        case 'fix':       patch.status='pending'; break;
        case 'showcase':  patch.showcasePending=true; break;
        case 'unshowcase':patch.showcase=false; patch.showcasePending=false; break;
        case 'delete':    patch.status='rejected'; patch.showcase=false; patch.showcasePending=false; break;
      }

      // Yazma — kurallar admin'e izin verirse geçer
      await setDoc(doc(db,'listings',id), { ...patch, updatedAt: serverTimestamp() }, { merge:true });

      Object.assign(cache[i], patch);
      await paint(); // tabloyu yenile
      // panel açıksa da güncelle
      if (document.getElementById('ldBackdrop')?.style.display === 'block') {
        openListingDetail(id);
      }
    }catch(err){
      console.error(err);
      alert('İşlem başarısız: ' + (err?.message || err));
    }finally{
      btn.disabled = false;
    }
  });

  selStatus?.addEventListener('change', paint);
  qInput?.addEventListener('input', paint);
  btnReload?.addEventListener('click', load);

  await load();
}

export default { mountAdminListings };
