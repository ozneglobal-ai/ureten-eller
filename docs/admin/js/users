// admin-users.js — ÜE Admin "Kullanıcılar" modülü
// Kullanım:
// <script type="module">
//   import { mountAdminUsers } from "/admin/admin-users.js";
//   mountAdminUsers({ container: document.getElementById('users'), onReady: ()=>console.log('users ready') });
// </script>

// Bu modül, firebase-init.js içinden db'yi almayı dener;
// bulamazsa /docs/ ve göreli yolları da sırayla dener.

const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js',
];

async function getFirebaseDb() {
  for (const p of FIREBASE_CANDIDATES) {
    try {
      const mod = await import(p + `?v=${Date.now()}`);
      if (mod?.db) return mod.db;
    } catch (_) { /* sıradaki yolu dene */ }
  }
  throw new Error('firebase-init.js bulunamadı ya da db dışa aktarılmadı');
}

let FF = null; // firestore helpers
async function getFF() {
  if (FF) return FF;
  FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  return FF;
}

function htmlesc(s){
  return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
}

function msToDays(ms){ return Math.max(0, Math.floor(ms/86400000)); }
function isPro(u){
  const ts = u.proUntil ?? u.premiumUntil;
  const untilMs = typeof ts==='number' ? ts : (ts?.seconds? ts.seconds*1000 : 0);
  return untilMs > Date.now();
}
function proLeftText(u){
  const ts = u.proUntil ?? u.premiumUntil;
  const untilMs = typeof ts==='number' ? ts : (ts?.seconds? ts.seconds*1000 : 0);
  if (!untilMs || untilMs<=Date.now()) return '—';
  const d = msToDays(untilMs - Date.now());
  return d>0 ? `AKTİF (${d}g)` : 'AKTİF (bugün)';
}

function skeletonHTML(){
  return `
    <div class="row" style="align-items:center; gap:12px; flex-wrap:wrap">
      <h2 style="margin-right:auto">Kullanıcı Yönetimi</h2>
      <input id="au-q" type="text" placeholder="Ad / e‑posta ara" style="background:transparent;border:1px solid #1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;outline:none"/>
      <button id="au-reload" class="btn-sm" style="appearance:none;border:none;background:#22d3ee;color:#001018;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:600">Yenile</button>
    </div>
    <div style="height:16px"></div>
    <div class="table-wrap">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Ad Soyad</th>
            <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">E‑posta</th>
            <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Rol</th>
            <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">Şehir</th>
            <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">PRO</th>
            <th style="padding:10px 8px;border-bottom:1px solid #1f2937;text-align:left">İşlem</th>
          </tr>
        </thead>
        <tbody id="au-body">
          <tr><td colspan="6" style="color:#9ca3af;padding:10px 8px">Yükleniyor…</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export async function mountAdminUsers({ container, onReady }={}){
  if (!container) throw new Error('mountAdminUsers: container eksik');
  container.classList.add('card');
  container.innerHTML = skeletonHTML();

  const qInput = container.querySelector('#au-q');
  const reloadBtn = container.querySelector('#au-reload');
  const body = container.querySelector('#au-body');

  let db = null, usersCache = [];
  try {
    db = await getFirebaseDb();
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" style="color:#ef4444;padding:10px 8px">Firebase hazır değil: ${htmlesc(e.message)}</td></tr>`;
    if (onReady) onReady(false);
    return;
  }

  const { collection, doc, getDocs, setDoc, query, orderBy, limit, serverTimestamp } = await getFF();

  function render(list){
    if (!list.length){
      body.innerHTML = '<tr><td colspan="6" style="color:#9ca3af;padding:10px 8px">Kayıt yok</td></tr>';
      return;
    }
    body.innerHTML = '';
    for (const u of list){
      const name  = u.displayName || u.name || '—';
      const email = u.email || '—';
      const role  = u.role || '—';
      const city  = u.city || '—';
      const proActive = isPro(u);
      const proTxt = proLeftText(u);
      const mainBtnLabel = proActive ? 'PRO ÜYE' : 'PRO VER';
      const mainBtnAction= proActive ? 'proOff' : 'pro12';
      const banned = !!u.banned;
      body.insertAdjacentHTML('beforeend', `
        <tr data-uid="${u.id}">
          <td><a class="user-link" href="/profile.html?uid=${encodeURIComponent(u.id)}" target="_blank">${htmlesc(name)}</a></td>
          <td>${htmlesc(email)}</td>
          <td>${htmlesc(role)}</td>
          <td>${htmlesc(city)}</td>
          <td>${proTxt}</td>
          <td class="actions" style="white-space:nowrap">
            <button class="btn-xs" data-action="${mainBtnAction}" data-uid="${u.id}">${mainBtnLabel}</button>
            ${banned
              ? `<button class="btn-xs" data-action="unban" data-uid="${u.id}">Ban Kaldır</button>`
              : `<button class="btn-xs danger" data-action="ban" data-uid="${u.id}">Banla</button>`}
          </td>
        </tr>
      `);
    }
  }

  async function load(){
    try{
      const qRef = query(collection(db,'users'), orderBy('email'), limit(500));
      const snap = await getDocs(qRef);
      usersCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      render(usersCache);
    }catch(err){
      console.error(err);
      body.innerHTML = `<tr><td colspan="6" style=\"color:#ef4444;padding:10px 8px\">Yüklenemedi: ${htmlesc(err.message)}</td></tr>`;
    }
  }

  function applyFilter(){
    const q = (qInput?.value || '').trim().toLowerCase();
    if (!q) return render(usersCache);
    const f = usersCache.filter(u =>
      (u.displayName||u.name||'').toLowerCase().includes(q) ||
      (u.email||'').toLowerCase().includes(q)
    );
    render(f);
  }

  reloadBtn?.addEventListener('click', load);
  qInput?.addEventListener('input', applyFilter);
  container.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-action]'); if(!btn) return;
    const uid = btn.getAttribute('data-uid'); if(!uid) return;
    btn.disabled = true;
    try{
      if (btn.dataset.action === 'pro12'){
        const until = Date.now() + 365*24*60*60*1000;
        await setDoc(doc(db,'users',uid), { proUntil: until, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(u=>u.id===uid); if (i>=0) usersCache[i].proUntil = until;
      } else if (btn.dataset.action === 'proOff'){
        await setDoc(doc(db,'users',uid), { proUntil: 0, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(u=>u.id===uid); if (i>=0) usersCache[i].proUntil = 0;
      } else if (btn.dataset.action === 'ban'){
        await setDoc(doc(db,'users',uid), { banned: true, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(u=>u.id===uid); if (i>=0) usersCache[i].banned = true;
      } else if (btn.dataset.action === 'unban'){
        await setDoc(doc(db,'users',uid), { banned: false, updatedAt: serverTimestamp() }, { merge:true });
        const i = usersCache.findIndex(u=>u.id===uid); if (i>=0) usersCache[i].banned = false;
      }
      applyFilter();
    }catch(err){
      console.error(err);
      alert('İşlem başarısız: ' + err.message);
    }finally{ btn.disabled = false; }
  });

  await load();
  if (onReady) onReady(true);
}

export default { mountAdminUsers };
