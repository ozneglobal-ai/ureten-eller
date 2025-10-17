// /admin/admin/js/listings.js — ÜE Admin: İlanlar modülü
// mountAdminListings({ container })

const FIREBASE_CANDIDATES = [
  '/firebase-init.js', './firebase-init.js', '../firebase-init.js', '/docs/firebase-init.js'
];

async function getFirebase(){
  for (const p of FIREBASE_CANDIDATES){
    try{
      const mod = await import(p + `?v=${Date.now()}`);
      if (mod?.db) return { db: mod.db, auth: mod.auth };
    }catch(_){}
  }
  throw new Error('firebase-init.js bulunamadı veya db export etmiyor');
}

let FF = null;
async function getFF(){
  if (FF) return FF;
  FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  return FF;
}

function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }
const DAY = 86400000;
const LIFE_DAYS = 30;

function fmtTRY(v){
  try{
    return new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(Number(v||0));
  }catch{ return (v||0)+' TL'; }
}

function badge(l){
  const tags = [];
  if (l.status==='pending') tags.push('Bekliyor');
  if (l.status==='approved'){
    const left = l.expiresAt ? Math.max(0, Math.ceil((l.expiresAt - Date.now())/DAY)) : LIFE_DAYS;
    tags.push(`${left} gün`);
    if (l.showcase) tags.push('⭐ Vitrin');
    if (l.showcasePending) tags.push('Onay bekliyor');
  }
  if (l.status==='expired') tags.push('Süre doldu');
  if (l.status==='rejected') tags.push('Reddedildi');
  if (l.status==='deleted') tags.push('Silindi');
  return tags.join(' • ');
}

export async function mountAdminListings({ container }){
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

  // Firebase
  let db;
  try{
    const fb = await getFirebase(); db = fb.db;
  }catch(e){
    const tbody = container.querySelector('#listingsBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted">Firebase hazır değil: ${esc(e.message)}</td></tr>`;
    return;
  }

  const { collection, doc, getDocs, setDoc, query, orderBy, limit, serverTimestamp } = await getFF();

  const tbody      = container.querySelector('#listingsBody');
  const selStatus  = container.querySelector('#listingFilter');
  const qInput     = container.querySelector('#qListing');
  const btnReload  = container.querySelector('#btnReloadListings');

  let cache = []; // {id, ...doc}

  async function load(){
    try{
      const qRef = query(collection(db,'listings'), orderBy('createdAt','desc'), limit(500));
      const snap = await getDocs(qRef);
      cache = snap.docs.map(d=>({ id: d.id, ...d.data() }));
      paint();
    }catch(err){
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Yüklenemedi</td></tr>`;
    }
  }

  function currentFilter(list){
    // status
    const st = selStatus?.value || 'pending';
    let arr = st==='all' ? list : list.filter(l => (l.status || 'pending') === st);
    // query
    const q = (qInput?.value || '').trim().toLowerCase();
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

  function paint(){
    const data = currentFilter(cache);
    tbody.innerHTML = data.length ? '' : `<tr><td colspan="6" class="muted">Kayıt yok</td></tr>`;
    for (const l of data){
      const price = fmtTRY(l.price);
      tbody.insertAdjacentHTML('beforeend', `
        <tr data-id="${esc(l.id)}">
          <td>${esc(l.title || '—')}</td>
          <td>${esc(l.sellerName || l.sellerId || '—')}</td>
          <td>${price}</td>
          <td>${esc(l.status || '—')}</td>
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
        </tr>
      `);
    }
  }

  // actions
  container.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-act]'); if(!btn) return;
    const tr  = btn.closest('tr[data-id]'); const id = tr?.dataset.id; if(!id) return;
    btn.disabled = true;
    try{
      const i = cache.findIndex(x=>x.id===id); if(i<0) return;
      const l = cache[i];
      const patch = {};
      const now = Date.now();

      switch (btn.dataset.act){
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
          patch.status = 'pending';
          break;
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
          // yumuşak silme
          patch.status = 'deleted';
          break;
      }

      await setDoc(doc(db,'listings',id), { ...patch, updatedAt: serverTimestamp() }, { merge:true });
      Object.assign(cache[i], patch);
      paint();
    }catch(err){
      console.error(err);
      alert('İşlem başarısız: ' + err.message);
    }finally{
      btn.disabled = false;
    }
  });

  selStatus?.addEventListener('change', paint);
  qInput?.addEventListener('input', paint);
  btnReload?.addEventListener('click', load);

  // go
  await load();
}

// default export (opsiyonel)
export default { mountAdminListings };
