// admin-listings.js — ÜE Admin "İlanlar" modülü
// Kullanım:
// <script type="module">
//   import { mountAdminListings } from "/admin/admin-listings.js";
//   mountAdminListings({ container: document.getElementById('listings') });
// </script>

const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js',
];

async function getFirebaseDb(){
  for (const p of FIREBASE_CANDIDATES){
    try{
      const mod = await import(p + `?v=${Date.now()}`);
      if (mod?.db) return mod.db;
    }catch(_){/* sonraki yolu dene */}
  }
  throw new Error('firebase-init.js bulunamadı ya da db dışa aktarılmadı');
}

let FF = null; // firestore helpers cache
async function getFF(){
  if (FF) return FF;
  FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  return FF;
}

function htmlesc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }

const ONE_DAY = 24*60*60*1000;
const DEFAULT_LIFETIME_DAYS = 30; // profildeki sabit ile uyumlu

function badge(txt){ return `<span style="display:inline-block;border:1px solid #1f2937;border-radius:999px;padding:2px 8px;font-size:12px">${htmlesc(txt)}</span>`; }

function skeleton(){
  return `
  <div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">
    <h2 style="margin-right:auto">İlanlar</h2>
    <select id="al-status" title="Durum filtresi">
      <option value="all">Tümü</option>
      <option value="pending">Onay Bekleyen</option>
      <option value="approved">Yayında</option>
      <option value="expired">Süresi Dolan</option>
      <option value="rejected">Reddedilen</option>
    </select>
    <input id="al-q" type="text" placeholder="Başlık / kullanıcı ara" style="background:transparent;border:1px solid #1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;outline:none"/>
    <button id="al-reload" class="btn-sm" style="appearance:none;border:none;background:#22d3ee;color:#001018;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:600">Yenile</button>
  </div>
  <div style="height:16px"></div>
  <div class="table-wrap">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">İlan</th>
          <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Satıcı</th>
          <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Fiyat</th>
          <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Durum</th>
          <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Vitrin</th>
          <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">İşlem</th>
        </tr>
      </thead>
      <tbody id="al-body">
        <tr><td colspan="6" style="color:#9ca3af;padding:10px 8px">Yükleniyor…</td></tr>
      </tbody>
    </table>
  </div>`;
}

export async function mountAdminListings({ container, onReady }={}){
  if (!container) throw new Error('mountAdminListings: container eksik');
  container.classList.add('card');
  container.innerHTML = skeleton();

  const statusSel = container.querySelector('#al-status');
  const qInput    = container.querySelector('#al-q');
  const reloadBtn = container.querySelector('#al-reload');
  const body      = container.querySelector('#al-body');

  let db = null; let listingsCache = [];
  try{ db = await getFirebaseDb(); }
  catch(e){
    body.innerHTML = `<tr><td colspan="6" style="color:#ef4444;padding:10px 8px">Firebase hazır değil: ${htmlesc(e.message)}</td></tr>`;
    if (onReady) onReady(false);
    return;
  }

  const { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit, where, serverTimestamp } = await getFF();

  function statusBadge(l){
    const s = l.status || 'pending';
    if (s==='approved'){
      const left = l.expiresAt ? Math.max(0, Math.ceil((toMs(l.expiresAt)-Date.now())/ONE_DAY)) : DEFAULT_LIFETIME_DAYS;
      return `${badge('Yayında')} ${badge(`${left}g kaldı`)}`;
    }
    if (s==='pending') return badge('Onay bekliyor');
    if (s==='rejected') return badge('Reddedildi');
    if (s==='expired')  return badge('Süresi doldu');
    return badge(s);
  }
  function showcaseBadge(l){
    const arr = [];
    if (l.showcase) arr.push('⭐');
    if (l.showcasePending) arr.push('Onay bekliyor');
    return arr.length ? arr.map(badge).join(' ') : '—';
  }
  function toMs(ts){ return typeof ts==='number' ? ts : (ts?.seconds ? ts.seconds*1000 : 0); }
  function fmtPrice(v){ try{ return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v||0)); }catch{ return String(v||0); } }

  function rowHTML(l){
    const title = l.title || '(Başlıksız)';
    const price = fmtPrice(l.price);
    const seller = l.sellerName || l.ownerName || l.owner || l.userName || '—';
    const link = `/ilan/${encodeURIComponent(l.id)}`;
    const canApprove = l.status==='pending' || l.status==='rejected' || l.status==='expired';
    const canReject  = l.status!=='rejected';
    const canRenew   = l.status==='approved' || l.status==='expired';
    const canRepublish = l.status==='expired' || l.status==='rejected';
    const canDel     = true;

    return `
      <tr data-id="${l.id}">
        <td>
          <div style="display:flex;gap:8px;align-items:center">
            ${l.photo ? `<img src="${htmlesc(l.photo)}" alt="thumb" style="width:48px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #1f2937"/>` : ''}
            <div>
              <a href="${link}" target="_blank">${htmlesc(title)}</a>
              <div style="color:#9ca3af;font-size:12px">${l.city||''} ${l.district? '• '+htmlesc(l.district):''}</div>
            </div>
          </div>
        </td>
        <td>${htmlesc(seller)}</td>
        <td>${price}</td>
        <td>${statusBadge(l)}</td>
        <td>${showcaseBadge(l)}</td>
        <td class="actions" style="white-space:nowrap">
          <button class="btn-xs" data-act="approve" ${canApprove?'':'disabled'}>Onayla</button>
          <button class="btn-xs danger" data-act="reject" ${canReject?'':'disabled'}>Reddet</button>
          <button class="btn-xs" data-act="renew" ${canRenew?'':'disabled'}>Süreyi Yenile</button>
          <button class="btn-xs" data-act="republish" ${canRepublish?'':'disabled'}>Yeniden Yayınla</button>
          <button class="btn-xs" data-act="show-ok">Vitrin Onay</button>
          <button class="btn-xs" data-act="show-off">Vitrin Kaldır</button>
          <button class="btn-xs danger" data-act="delete" ${canDel?'':'disabled'}>Sil</button>
        </td>
      </tr>`;
  }

  function render(list){
    const sVal = statusSel?.value || 'all';
    const qVal = (qInput?.value || '').trim().toLowerCase();
    let arr = list;
    if (sVal!=='all') arr = arr.filter(l=> (l.status||'pending')===sVal);
    if (qVal){
      arr = arr.filter(l =>
        (l.title||'').toLowerCase().includes(qVal) ||
        (l.sellerName||l.ownerName||l.owner||l.userName||'').toLowerCase().includes(qVal)
      );
    }
    if (!arr.length){
      body.innerHTML = '<tr><td colspan="6" style="color:#9ca3af;padding:10px 8px">Kayıt yok</td></tr>';
      return;
    }
    body.innerHTML = arr.map(rowHTML).join('');
  }

  async function load(){
    try{
      // createdAt varsa ona göre, yoksa price/title yedeği ile sırala
      let qRef;
      try{
        qRef = query(collection(db,'listings'), orderBy('createdAt','desc'), limit(500));
      }catch{ // createdAt yoksa fallback
        qRef = query(collection(db,'listings'), orderBy('price','desc'), limit(500));
      }
      const snap = await getDocs(qRef);
      listingsCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      render(listingsCache);
    }catch(err){
      console.error(err);
      body.innerHTML = `<tr><td colspan="6" style=\"color:#ef4444;padding:10px 8px\">Yüklenemedi: ${htmlesc(err.message)}</td></tr>`;
    }
  }

  statusSel?.addEventListener('change', ()=>render(listingsCache));
  qInput?.addEventListener('input', ()=>render(listingsCache));
  reloadBtn?.addEventListener('click', load);

  container.addEventListener('click', async (e)=>{
    const tr = e.target.closest('tr[data-id]'); if(!tr) return;
    const id = tr.getAttribute('data-id'); if(!id) return;
    const actBtn = e.target.closest('button[data-act]'); if(!actBtn) return;
    const act = actBtn.getAttribute('data-act');
    actBtn.disabled = true;
    try{
      const ref = doc(db,'listings',id);
      if (act==='approve'){
        const until = Date.now() + DEFAULT_LIFETIME_DAYS*ONE_DAY;
        await setDoc(ref, { status:'approved', expiresAt: until, updatedAt: serverTimestamp() }, { merge:true });
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache[i].status='approved'; listingsCache[i].expiresAt=until; }
      }
      else if (act==='reject'){
        const reason = prompt('Reddetme nedeni (opsiyonel):') || '';
        await setDoc(ref, { status:'rejected', rejectReason: reason, updatedAt: serverTimestamp() }, { merge:true });
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache[i].status='rejected'; listingsCache[i].rejectReason=reason; }
      }
      else if (act==='renew'){
        const extraDays = Number(prompt('Kaç gün uzatılsın?', String(DEFAULT_LIFETIME_DAYS))) || DEFAULT_LIFETIME_DAYS;
        const base = Date.now();
        const until = base + extraDays*ONE_DAY;
        await setDoc(ref, { expiresAt: until, status:'approved', updatedAt: serverTimestamp() }, { merge:true });
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache[i].expiresAt=until; listingsCache[i].status='approved'; }
      }
      else if (act==='republish'){
        const until = Date.now() + DEFAULT_LIFETIME_DAYS*ONE_DAY;
        await setDoc(ref, { status:'pending', expiresAt: until, updatedAt: serverTimestamp() }, { merge:true });
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache[i].status='pending'; listingsCache[i].expiresAt=until; }
      }
      else if (act==='show-ok'){
        await setDoc(ref, { showcase:true, showcasePending:false, updatedAt: serverTimestamp() }, { merge:true });
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache[i].showcase=true; listingsCache[i].showcasePending=false; }
      }
      else if (act==='show-off'){
        await setDoc(ref, { showcase:false, showcasePending:false, updatedAt: serverTimestamp() }, { merge:true });
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache[i].showcase=false; listingsCache[i].showcasePending=false; }
      }
      else if (act==='delete'){
        if (!confirm('Bu ilan kalıcı olarak silinecek. Emin misiniz?')) return;
        await deleteDoc(ref);
        const i = listingsCache.findIndex(x=>x.id===id); if(i>=0){ listingsCache.splice(i,1); }
      }
      render(listingsCache);
    }catch(err){
      console.error(err);
      alert('İşlem başarısız: ' + err.message);
    }finally{
      actBtn.disabled = false;
    }
  });

  await load();
  if (onReady) onReady(true);
}

export default { mountAdminListings };
