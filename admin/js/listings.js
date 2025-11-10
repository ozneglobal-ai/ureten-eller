// /admin/js/listings.js — ÜE Admin: İlanlar modülü (detay + satıcı bilgisi + aksiyonlar)
// Bu dosya yalnıza kökteki firebase-init.js'nin global helper'larını kullanır.
// window.__fb.auth -> Auth, window.firebase -> Firestore yardımcıları (col, q, orderBy, limit, getDoc, getDocs, setDoc, serverTimestamp)

function esc(s){ return String(s ?? '').replace(/[&<>\"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
const DAY=86400000, LIFE_DAYS=30;

function fmtTRY(v){
  try{ return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v||0)); }
  catch{ return (v||0)+' TL'; }
}

// Süre etiketi: expiresAt varsa gün hesaplar, yoksa sadece durum rozetini yazar.
function badge(l){
  const tags=[]; const st = l.status || 'pending';
  if (st==='pending') tags.push('Bekliyor');
  if (st==='approved') {
    if (typeof l.expiresAt === 'number') {
      const left = Math.max(0, Math.ceil((l.expiresAt - Date.now())/DAY));
      tags.push(`${left} gün`);
    }
    if (l.showcase) tags.push('⭐ Vitrin');
    if (l.showcasePending) tags.push('Onay bekliyor');
  }
  if (st==='expired') tags.push('Süre doldu');
  if (st==='rejected') tags.push('Reddedildi');
  return tags.join(' • ');
}

/* ----------------- admin guard ----------------- */
async function ensureAdminAuth(){
  const auth = window.__fb && window.__fb.auth;
  if (!auth) throw new Error('admin-login-required');

  if (!auth.currentUser && typeof window.__fb.onAuthStateChanged === 'function'){
    await new Promise(res=>{
      const stop = window.__fb.onAuthStateChanged(auth, (u)=>{ if(u){ try{stop();}catch{} res(); }});
    });
  }
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('admin-login-required');

  if (!window.firebase || !window.firebase.getDoc) throw new Error('roles-read-failed');

  let isAdmin = false;
  try{
    const snap = await window.firebase.getDoc(`users/${auth.currentUser.uid}`);
    if (snap?.exists && snap.exists()) {
      const r = (snap.data().role || '').toString().toLowerCase();
      isAdmin = (r === 'admin');
    }
  }catch(e){ console.error('[admin] role read error:', e); }

  if (!isAdmin) {
    try{
      const t = await auth.currentUser.getIdTokenResult(true);
      const email = (auth.currentUser.email||'').toLowerCase();
      isAdmin = (t?.claims?.admin === true) || email.endsWith('@ureteneller.com');
    }catch{}
  }

  if (!isAdmin) throw new Error('not-admin');
  return { auth };
}

/* ----------------- detay panel UI (tek sefer kur) ----------------- */
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

/* ----------------- ana modül ----------------- */
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
  try { await ensureAdminAuth(); }
  catch(e){
    const tbody = container.querySelector('#listingsBody');
    const msg = e?.message==='admin-login-required'
      ? 'Admin panel için e-posta/şifre ile giriş yapın (anonim oturum reddedildi).'
      : 'Bu bölümü görmek için admin yetkisi gerekiyor.';
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">${esc(msg)}</td></tr>`;
    return;
  }

  // Helper’lar hazır mı?
    if (!window.firebase || !window.firebase.getDocs) {
    const tbody = container.querySelector('#listingsBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">Firebase helper yok (firebase-init.js yüklenmeli)</td></tr>`;
    return;
  }

  // DOM
  const tbody     = container.querySelector('#listingsBody');
  const selStatus = container.querySelector('#listingFilter');
  const qInput    = container.querySelector('#qListing');
  const btnReload = container.querySelector('#btnReloadListings');

  ensureDetailHost();

  let cache = []; // {id, ...}

  // satıcı bilgisi (adı/e-posta)
  async function getSellerMeta(sellerId){
    if (!sellerId) return { name:'—', email:'—' };
    try{
      const snap = await window.firebase.getDoc(`users/${sellerId}`);
      if (!snap.exists()) return { name:'—', email:'—' };
      const d = snap.data();
      return { name: d.displayName || d.name || '—', email: d.email || '—' };
    }catch{ return { name:'—', email:'—' }; }
  }

  // load
  async function load(){
    try{
      const qRef = window.firebase.q(
        window.firebase.col('listings'),
        window.firebase.orderBy('createdAt','desc'),
        window.firebase.limit(500)
      );
      const snap = await window.firebase.getDocs(qRef);
      cache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      paint();
    }catch(err){
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Yüklenemedi</td></tr>`;
    }
  }

  // filtre
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

  // tablo çiz
  function paint(){
    const data = currentFilter(cache);
    tbody.innerHTML = data.length ? '' : `<tr><td colspan="6" class="muted">Kayıt yok</td></tr>`;
    for (const l of data){
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

  // detay paneli
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
          <div><div class="muted">Satıcı Adı</div><div>${esc(seller.name)}</div></div>
          <div><div class="muted">Satıcı E-posta</div><div>${esc(seller.email)}</div></div>
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

  // başlığa tıklayınca detay
  tbody.addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-open]'); if (!a) return;
    e.preventDefault(); openListingDetail(a.getAttribute('data-open'));
  });

  // aksiyonlar (tablo + panel)
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-act]'); if(!btn) return;
    const id  = btn.getAttribute('data-id') || btn.closest('tr')?.dataset.id;
    if (!id) return;

    btn.disabled = true;
    try{
      const i = cache.findIndex(x => x.id === id); if (i < 0) return;
      const l = cache[i];
      const patch = {};
      // NOT: Güvenlik kuralları 'expiresAt' update'ine izin vermiyor. Bu yüzden yazmıyoruz.
      // Kurallara 'expiresAt' eklersen şunları aç:
      //   patch.expiresAt = Date.now() + LIFE_DAYS*DAY;

      switch (btn.dataset.act) {
        case 'approve':
          patch.status='approved';
          break;
        case 'reject':
          patch.status='rejected';
          patch.showcase=false; patch.showcasePending=false;
          break;
        case 'renew':
          // patch.expiresAt = Date.now() + LIFE_DAYS*DAY; // (kurallara eklediğinde aç)
          // Şimdilik sadece dokümanı dokundurup updatedAt güncelliyoruz:
          break;
        case 'republish':
        case 'fix':
          patch.status='pending';
          break;
        case 'showcase':
          patch.showcasePending=true;
          break;
        case 'unshowcase':
          patch.showcase=false; patch.showcasePending=false;
          break;
        case 'delete':
          patch.status='rejected'; patch.showcase=false; patch.showcasePending=false;
          break;
      }

      await window.firebase.updateDoc(
  `listings/${id}`,
  { ...patch, updatedAt: window.firebase.serverTimestamp() }
);

      Object.assign(cache[i], patch);

      // satırı tazele
      (function repaint(idToRefresh){
        const r = tbody.querySelector(`tr[data-id="${CSS.escape(idToRefresh)}"]`);
        if (!r) return;
        const nl = cache[i];
        r.querySelector('.td-title a').textContent = nl.title || '—';
        r.children[2].textContent = fmtTRY(nl.price);
        r.children[3].textContent = nl.status || '—';
        r.children[4].textContent = badge(nl) || '—';
      })(id);

      // panel açıksa yenile
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

  selStatus?.addEventListener('change', ()=>paint());
  qInput?.addEventListener('input',  ()=>paint());
  btnReload?.addEventListener('click', load);

  await load();
}

export default { mountAdminListings };
