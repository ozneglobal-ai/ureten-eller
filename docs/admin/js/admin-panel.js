// --- SEKME: sadece tıklanan bölüm görünsün ---
const sections  = Array.from(document.querySelectorAll('.section'));
const links     = Array.from(document.querySelectorAll('.menu a'));
const emptyHint = document.getElementById('emptyHint');

function hideAll(){ sections.forEach(s=>s.classList.remove('active')); links.forEach(a=>a.classList.remove('active')); if(emptyHint) emptyHint.style.display=''; }
function show(id){
  hideAll();
  const target = document.getElementById(id);
  if (target){
    target.classList.add('active');
    const link = links.find(a => (a.dataset.target === id) || a.getAttribute('href') === `#${id}`);
    if (link) link.classList.add('active');
    if (emptyHint) emptyHint.style.display = 'none';
    history.replaceState(null, '', `#${id}`);
  }
}
links.forEach(a => a.addEventListener('click',(e)=>{e.preventDefault(); const id=a.dataset.target||(a.getAttribute('href')||'').replace('#',''); if(id) show(id);}));
hideAll(); // başlangıç boş

// --- FIREBASE ---
import { db } from "/firebase-init.js";
import {
  collection, doc, getDocs, setDoc, query, orderBy, limit,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// === KULLANICILAR ===
const usersBody      = document.getElementById('usersBody');
const btnReloadUsers = document.getElementById('btnReloadUsers');
const qUserInput     = document.getElementById('qUser');
let usersCache = []; // {id, ...}

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

async function loadUsers(){
  const qRef = query(collection(db,'users'), orderBy('email'), limit(500));
  const snap = await getDocs(qRef);
  usersCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  renderUsers(usersCache);
}

function renderUsers(list){
  if (!usersBody) return;
  usersBody.innerHTML = list.length ? '' : '<tr><td colspan="6" class="muted">Kayıt yok</td></tr>';
  for (const u of list){
    const name  = u.displayName || '—';
    const email = u.email || '—';
    const role  = u.role || '—';
    const city  = u.city || '—';
    const proActive = isPro(u);
    const proTxt = proLeftText(u);
    const mainBtnLabel = proActive ? 'PRO ÜYE' : 'PRO VER';
    const mainBtnAction= proActive ? 'proOff' : 'pro12';
    const banned = !!u.banned;

    usersBody.insertAdjacentHTML('beforeend', `
      <tr data-uid="${u.id}">
        <td>
          <a class="user-link" href="/profile.html?uid=${encodeURIComponent(u.id)}" target="_blank">
            ${escapeHtml(name)}
          </a>
        </td>
        <td>${escapeHtml(email)}</td>
        <td>${escapeHtml(role)}</td>
        <td>${escapeHtml(city)}</td>
        <td data-proleft>${proTxt}</td>
        <td class="actions">
          <button class="btn-xs" data-action="${mainBtnAction}">${mainBtnLabel}</button>
          ${banned
            ? `<button class="btn-xs" data-action="unban">Ban Kaldır</button>`
            : `<button class="btn-xs" data-action="ban">Banla</button>`}
        </td>
      </tr>
    `);
  }
}

// Arama (isim/e-posta)
function applyFilter(){
  const q = (qUserInput?.value || '').trim().toLowerCase();
  if (!q) return renderUsers(usersCache);
  const filtered = usersCache.filter(u =>
    (u.displayName||'').toLowerCase().includes(q) ||
    (u.email||'').toLowerCase().includes(q)
  );
  renderUsers(filtered);
}

btnReloadUsers?.addEventListener('click', loadUsers);
qUserInput?.addEventListener('input', applyFilter);

// İşlemler: PRO 12 ay / PRO iptal / Ban / Unban
usersBody?.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const tr  = btn.closest('tr[data-uid]'); const uid = tr?.dataset.uid;
  if (!uid) return;
  btn.disabled = true;
  try{
    if (btn.dataset.action === 'pro12'){
      const until = Date.now() + 365*24*60*60*1000; // 12 ay
      await setDoc(doc(db,'users',uid), { proUntil: until, updatedAt: serverTimestamp() }, { merge:true });
      // UI güncelle
      const i = usersCache.findIndex(u=>u.id===uid);
      if (i>=0){ usersCache[i].proUntil = until; }
    }
    else if (btn.dataset.action === 'proOff'){
      await setDoc(doc(db,'users',uid), { proUntil: 0, updatedAt: serverTimestamp() }, { merge:true });
      const i = usersCache.findIndex(u=>u.id===uid);
      if (i>=0){ usersCache[i].proUntil = 0; }
    }
    else if (btn.dataset.action === 'ban'){
      await setDoc(doc(db,'users',uid), { banned: true, updatedAt: serverTimestamp() }, { merge:true });
      const i = usersCache.findIndex(u=>u.id===uid);
      if (i>=0){ usersCache[i].banned = true; }
    }
    else if (btn.dataset.action === 'unban'){
      await setDoc(doc(db,'users',uid), { banned: false, updatedAt: serverTimestamp() }, { merge:true });
      const i = usersCache.findIndex(u=>u.id===uid);
      if (i>=0){ usersCache[i].banned = false; }
    }
    // yeniden çiz (buton etiketi PRO ÜYE ↔ PRO VER)
    applyFilter();
  }catch(err){
    console.error(err); alert('İşlem başarısız.');
  }finally{
    btn.disabled = false;
  }
});

// "Kullanıcılar" sekmesi ilk açılışta veriyi yüklesin
document.querySelector('a[data-target="users"]')?.addEventListener('click', () => {
  if (!usersCache.length) loadUsers();
});

// PRO kalan günleri otomatik güncelle (dakikada bir)
setInterval(()=>{ if (!document.getElementById('users')?.classList.contains('active')) return; renderUsers(usersCache); }, 60000);

// HTML escape
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// === MESAJLAR (home.html’den gelen canlı destek) ===
// Varsayılan şema: conversations/{id} {lastMessage, updatedAt, userId, userName}
// Mesajlar: conversations/{id}/messages/{auto} {text, from, createdAt}
const convList = document.getElementById('conversations');
if (convList){
  const convQ = query(collection(db,'conversations'), orderBy('updatedAt','desc'), limit(50));
  onSnapshot(convQ, snap=>{
    convList.innerHTML = '';
    snap.forEach(d=>{
      const c = d.data();
      convList.insertAdjacentHTML('beforeend', `
        <div class="card" data-conv="${d.id}">
          <div class="row">
            <strong>${escapeHtml(c.userName || c.userId || d.id)}</strong>
            <span class="muted" style="margin-left:auto">${c.updatedAt?.toDate ? c.updatedAt.toDate().toLocaleString() : ''}</span>
          </div>
          <div class="muted">${escapeHtml(c.lastMessage || '')}</div>
          <a class="btn-sm" href="/admin/chat.html?cid=${encodeURIComponent(d.id)}">Aç</a>
        </div>
      `);
    });
  });
}
