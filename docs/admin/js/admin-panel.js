// --- SEKMELER: sadece tıklanan bölüm görünsün ---
const sections  = Array.from(document.querySelectorAll('.section'));
const links     = Array.from(document.querySelectorAll('.menu a'));
const emptyHint = document.getElementById('emptyHint');

function hideAll(){
  sections.forEach(s => s.classList.remove('active'));
  links.forEach(a => a.classList.remove('active'));
  if (emptyHint) emptyHint.style.display = '';
}
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
links.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const id = a.dataset.target || (a.getAttribute('href') || '').replace('#','');
    if (id) show(id);
  });
});
hideAll(); // başlangıç boş

// --- KULLANICI YÖNETİMİ: listele, ara, PRO ver/iptal, banla/ban kaldır ---
import { db } from "/firebase-init.js";
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const usersBody     = document.getElementById('usersBody');
const btnReloadUsers= document.getElementById('btnReloadUsers');
const qUserInput    = document.getElementById('qUser');

let usersCache = []; // {id, ...data}

async function loadUsers(){
  // createdAt yoksa sorun olmasın diye email'e göre sırala
  const qRef = query(collection(db, 'users'), orderBy('email'), limit(200));
  const snap = await getDocs(qRef);
  usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers(usersCache);
}

function fmtPro(u){
  const ts = u.proUntil ?? u.premiumUntil; // iki alandan biri olabilir
  const until = typeof ts === 'number' ? ts : (ts?.seconds ? ts.seconds*1000 : null);
  if (!until) return '—';
  return (until > Date.now()) ? 'AKTİF' : '—';
}

function renderUsers(list){
  if (!usersBody) return;
  usersBody.innerHTML = (list.length ? '' : '<tr><td colspan="6" class="muted">Kayıt yok</td></tr>');
  for (const u of list){
    const name  = u.displayName || '—';
    const email = u.email || '—';
    const role  = u.role || '—';
    const city  = u.city || '—';
    const pro   = fmtPro(u);
    const banned = !!u.banned;

    usersBody.insertAdjacentHTML('beforeend', `
      <tr data-uid="${u.id}">
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(email)}</td>
        <td>${escapeHtml(role)}</td>
        <td>${escapeHtml(city)}</td>
        <td>${pro}</td>
        <td class="actions">
          <button class="btn-xs" data-action="pro12">PRO +12</button>
          <button class="btn-xs" data-action="proOff">PRO İptal</button>
          ${banned
            ? `<button class="btn-xs" data-action="unban">Ban Kaldır</button>`
            : `<button class="btn-xs" data-action="ban">Banla</button>`}
        </td>
      </tr>
    `);
  }
}

// Basit arama: isim/e-posta içinde geçiyorsa (istemci tarafı filtre)
function applyFilter(){
  const q = (qUserInput?.value || '').trim().toLowerCase();
  if (!q) return renderUsers(usersCache);
  const filtered = usersCache.filter(u =>
    (u.displayName || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
  renderUsers(filtered);
}

// Eventler
btnReloadUsers?.addEventListener('click', loadUsers);
qUserInput?.addEventListener('input', applyFilter);

// Yetki işlemleri
usersBody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const tr  = btn.closest('tr[data-uid]');
  const uid = tr?.dataset.uid;
  if (!uid) return;

  try{
    btn.disabled = true;

    if (btn.dataset.action === 'pro12'){
      // 12 ay PRO
      const until = Date.now() + 365*24*60*60*1000;
      await setDoc(doc(db, 'users', uid), { proUntil: until, updatedAt: serverTimestamp() }, { merge: true });
    }
    else if (btn.dataset.action === 'proOff'){
      await setDoc(doc(db, 'users', uid), { proUntil: 0, updatedAt: serverTimestamp() }, { merge: true });
    }
    else if (btn.dataset.action === 'ban'){
      await setDoc(doc(db, 'users', uid), { banned: true, updatedAt: serverTimestamp() }, { merge: true });
    }
    else if (btn.dataset.action === 'unban'){
      await setDoc(doc(db, 'users', uid), { banned: false, updatedAt: serverTimestamp() }, { merge: true });
    }

    // Yerel önbelleği güncelle ve yeniden çiz
    const i = usersCache.findIndex(u => u.id === uid);
    if (i >= 0){
      if (btn.dataset.action === 'pro12') usersCache[i].proUntil = Date.now() + 365*24*60*60*1000;
      if (btn.dataset.action === 'proOff') usersCache[i].proUntil = 0;
      if (btn.dataset.action === 'ban') usersCache[i].banned = true;
      if (btn.dataset.action === 'unban') usersCache[i].banned = false;
    }
    applyFilter();
  }catch(err){
    console.error('Kullanıcı güncelleme hatası:', err);
    alert('İşlem başarısız.');
  }finally{
    btn.disabled = false;
  }
});

// "Kullanıcılar" sekmesi açılınca veriyi yükle (ilk kez)
document.querySelector('a[data-target="users"]')?.addEventListener('click', () => {
  if (!usersCache.length) loadUsers();
});

// Yardımcı
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
