<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ÜE • Admin Paneli</title>
  <meta name="description" content="Üreten Eller yönetim paneli" />
  <link rel="icon" href="/assets/icons/favicon.png" />
  <style>
    :root{
      --bg1:#0b1220; --bg2:#0a0f1c; --card:#0e172a; --ink:#e5e7eb; --muted:#9ca3af; --accent:#22d3ee;
      --ok:#10b981; --warn:#f59e0b; --err:#ef4444; --brd:#1f2937
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{margin:0; background:linear-gradient(180deg,var(--bg1),var(--bg2)); color:var(--ink);
         font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
    header.top{height:56px; display:flex; align-items:center; gap:12px; padding:0 16px;
      background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0)); backdrop-filter:blur(6px);
      position:sticky; top:0; z-index:5; border-bottom:1px solid rgba(255,255,255,.06)}
    .layout{display:grid; grid-template-columns:240px 1fr; min-height:calc(100vh - 56px)}
    nav.menu{border-right:1px solid var(--brd); padding:16px; background:rgba(0,0,0,.15)}
    nav.menu a{display:block; padding:10px 12px; border-radius:10px; color:var(--ink); text-decoration:none; cursor:pointer}
    nav.menu a:hover{background:rgba(255,255,255,.06)}
    nav.menu a.active{background:rgba(34,211,238,.12); color:#bff6ff; border:1px solid rgba(34,211,238,.35)}
    main.content{padding:20px}
    .section{display:none}
    .section.active{display:block}
    .card{background:var(--card); border:1px solid var(--brd); border-radius:16px; padding:16px; box-shadow:0 8px 30px rgba(0,0,0,.25)}
    .muted{color:var(--muted)}
    .row{display:flex; gap:12px; align-items:center; flex-wrap:wrap}
    .space{height:16px}
    input[type="text"], select{background:transparent; border:1px solid var(--brd); color:var(--ink); padding:10px 12px; border-radius:10px; outline:none}
    button, .btn{appearance:none; border:none; background:var(--accent); color:#001018; padding:10px 14px; border-radius:10px; cursor:pointer; font-weight:600}
    .btn-xs{padding:6px 10px; font-size:12px}
    .btn-sm{padding:8px 12px; font-size:13px}
    .btn[disabled]{opacity:.6; cursor:default}
    .danger{background:var(--err); color:#fff}
    table{width:100%; border-collapse:collapse}
    th, td{padding:10px 8px; border-bottom:1px solid var(--brd); text-align:left}
    th{font-weight:600; color:#e8f3f5}
    td.actions{white-space:nowrap}
    .badge{display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid var(--brd)}
    .badge.pro{border-color:var(--ok)}
  </style>
</head>
<body>
  <header class="top">
    <strong>ÜE • Admin</strong>
    <span class="muted">Yönetim Konsolu</span>
    <a class="btn" style="margin-left:auto" href="/index.html">Çıkış</a>
  </header>

  <div class="layout">
    <nav class="menu" id="sideMenu">
      <a data-target="summary" class="active" href="#summary">Özet</a>
      <a data-target="users" href="#users">Kullanıcılar</a>
      <a data-target="listings" href="#listings">İlanlar</a>
      <a data-target="orders" href="#orders">Siparişler</a>
      <a data-target="messages" href="#messages">Mesajlar</a>
      <a data-target="alerts" href="#alerts">Bildirim</a>
      <a data-target="reports" href="#reports">Raporlar</a>
      <a data-target="settings" href="#settings">Ayarlar</a>
    </nav>

    <main class="content">
      <div id="emptyHint" class="muted">Soldan bir bölüm seçin.</div>

      <!-- ÖZET -->
      <section id="summary" class="section card">
        <h2>Özet</h2>
        <p class="muted">Genel durum, hızlı istatistikler ve son hareketler burada görünecek.</p>
      </section>

      <!-- KULLANICILAR -->
      <section id="users" class="section card">
        <div class="row">
          <h2 style="margin-right:auto">Kullanıcı Yönetimi</h2>
          <input id="qUser" type="text" placeholder="Ad / e‑posta ara" />
          <button id="btnReloadUsers" class="btn-sm">Yenile</button>
        </div>
        <div class="space"></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E‑posta</th>
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
      </section>

      <!-- İLANLAR -->
      <section id="listings" class="section card">
        <h2>İlanlar</h2>
        <p class="muted">Yayında / Bekleyen / Reddedilen ilanlar burada listelenecek.</p>
      </section>

      <!-- SİPARİŞLER -->
      <section id="orders" class="section card">
        <h2>Siparişler</h2>
        <p class="muted">Sipariş akışı ve durumları burada görüntülenecek.</p>
      </section>

      <!-- MESAJLAR -->
      <section id="messages" class="section card">
        <h2>Mesajlar</h2>
        <div id="conversations" class="grid"></div>
      </section>

      <!-- BİLDİRİM -->
      <section id="alerts" class="section card">
        <h2>Bildirim</h2>
        <p class="muted">Sistem uyarıları ve bildirim ayarları.</p>
      </section>

      <!-- RAPORLAR -->
      <section id="reports" class="section card">
        <h2>Raporlar</h2>
        <p class="muted">Satış, kullanıcı ve trafik raporları.</p>
      </section>

      <!-- AYARLAR -->
      <section id="settings" class="section card">
        <h2>Ayarlar</h2>
        <p class="muted">Panel ve platform ayarları.</p>
      </section>
    </main>
  </div>

  <!-- SCRIPT -->
  <script type="module">
    // ---- CLICK ÇALIŞIYOR MU? (Firebase olmadan da) ----
    window.__adminAction = function(event){
      const btn = event?.target?.closest('button[data-action]');
      if (!btn) return;
      const uid = btn.closest('tr[data-uid]')?.dataset?.uid || '(yok)';
      console.log('[stub adminAction]', btn.dataset.action, uid);
      if (!window.__fbReady) {
        console.warn('Firebase yüklenmediği için işlem yapılmadı.');
        return;
      }
    };

    // --- SEKME: sadece tıklanan bölüm görünsün ---
    const sections  = Array.from(document.querySelectorAll('.section'));
    const links     = Array.from(document.querySelectorAll('.menu a'));
    const emptyHint = document.getElementById('emptyHint');

    function hideAll(){
      sections.forEach(s=>s.classList.remove('active'));
      links.forEach(a=>a.classList.remove('active'));
      if (emptyHint) emptyHint.style.display='';
    }
    function show(id){
      hideAll();
      const target = document.getElementById(id);
      if (target){
        target.classList.add('active');
        const link = links.find(a => (a.dataset.target === id) || a.getAttribute('href') === `#${id}`);
        if (link) link.classList.add('active');
        if (emptyHint) emptyHint.style.display='none';
        history.replaceState(null, '', `#${id}`);
        if (id === 'users' && !usersCache.length) loadUsers();
        if (id === 'messages' && !convInit) initConversations();
      }
    }
    document.getElementById('sideMenu')?.addEventListener('click',(e)=>{
      const a = e.target.closest('a[data-target]');
      if(!a) return;
      e.preventDefault();
      const id=a.dataset.target||(a.getAttribute('href')||'').replace('#','');
      if(id) show(id);
    });

    // Başlangıç: hash varsa onu, yoksa summary
    const first = (location.hash || '#summary').replace('#','');
    show(first);

    // --- FIREBASE (GÜNCEL KORUMALI SÜRÜM) ---
let __firestoreLoaded = false; window.__fbReady = false;
let db = null;
async function loadFirebaseConfig(){
  const candidates = [
    '/firebase-init.js',            // kökten servis
    './firebase-init.js',           // aynı klasör
    '../firebase-init.js',          // bir üst
    '/docs/firebase-init.js'        // GitHub Pages gibi
  ];
  for (const p of candidates){
    try{
      const mod = await import(p + `?v=${Date.now()}`);
      if (mod?.db){ db = mod.db; window.__fbReady = true; return; }
    }catch(e){ /* sıradaki yolu dene */ }
  }
  console.error('firebase-init.js bulunamadı (tüm yollar denendi)');
  window.__fbReady = false;
}
await loadFirebaseConfig();

// Firestore yardımcıları (db değildir)
import {
  collection, doc, getDocs, setDoc, query, orderBy, limit,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
__firestoreLoaded = true;

    // === KULLANICILAR ===
    let usersBody = document.getElementById('usersBody');
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
      if (!window.__fbReady || !db) {
        if (usersBody) usersBody.innerHTML = '<tr><td colspan="6" class="muted">Firebase hazır değil</td></tr>';
        return;
      }
      try{
        const qRef = query(collection(db,'users'), orderBy('email'), limit(500));
        const snap = await getDocs(qRef);
        usersCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
        renderUsers(usersCache);
      }catch(err){
        console.error(err);
        if (usersBody) usersBody.innerHTML = '<tr><td colspan="6" class="muted">Yüklenemedi</td></tr>';
      }
    }

    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }

    function renderUsers(list){
      usersBody = document.getElementById('usersBody');
      if (!usersBody) return;
      usersBody.innerHTML = list.length ? '' : '<tr><td colspan="6" class="muted">Kayıt yok</td></tr>';
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
              <button class="btn-xs" data-action="${mainBtnAction}" onclick="window.__adminAction && __adminAction(event)">${mainBtnLabel}</button>
              ${banned
                ? `<button class="btn-xs" data-action="unban" onclick="window.__adminAction && __adminAction(event)">Ban Kaldır</button>`
                : `<button class="btn-xs danger" data-action="ban" onclick="window.__adminAction && __adminAction(event)">Banla</button>`}
            </td>
          </tr>
        `);
      }
    }

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
    window.__adminAction = async function(event){
      const btn = event?.target?.closest('button[data-action]');
      if (!btn) return;
      const tr  = btn.closest('tr[data-uid]'); const uid = tr?.dataset.uid;
      if (!uid) return;
      console.log('[adminAction]', btn.dataset.action, uid);
      if (!window.__fbReady || !db){ console.warn('Firebase hazır değil.'); return; }
      btn.disabled = true;
      try{
        if (btn.dataset.action === 'pro12'){
          const until = Date.now() + 365*24*60*60*1000;
          await setDoc(doc(db,'users',uid), { proUntil: until, updatedAt: serverTimestamp() }, { merge:true });
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
        applyFilter();
      }catch(err){
        console.error(err); alert('İşlem başarısız.');
      }finally{
        btn.disabled = false;
      }
    };

    // Belge seviyesinde delege
    document.addEventListener('click', (e)=>{
      if (e.target.closest('button[data-action]')) {
        window.__adminAction(e);
      }
    });

    // PRO kalan günleri otomatik güncelle (dakikada bir)
    setInterval(()=>{
      if (!document.getElementById('users')?.classList.contains('active')) return;
      renderUsers(usersCache);
    }, 60000);

    // === MESAJLAR (canlı destek) ===
    let convInit = false;
    function initConversations(){
      if (convInit) return; convInit = true;
      if (!window.__fbReady || !db) return;
      const convList = document.getElementById('conversations');
      if (!convList) return;
      const convQ = query(collection(db,'conversations'), orderBy('updatedAt','desc'), limit(50));
      onSnapshot(convQ, snap=>{
        convList.innerHTML = '';
        snap.forEach(d=>{
          const c = d.data();
          const when = c.updatedAt?.toDate ? c.updatedAt.toDate().toLocaleString() : '';
          convList.insertAdjacentHTML('beforeend', `
            <div class="card" data-conv="${d.id}" style="margin-bottom:12px">
              <div class="row">
                <strong>${escapeHtml(c.userName || c.userId || d.id)}</strong>
                <span class="muted" style="margin-left:auto">${when}</span>
              </div>
              <div class="muted">${escapeHtml(c.lastMessage || '')}</div>
              <a class="btn-sm" href="/admin/chat.html?cid=${encodeURIComponent(d.id)}">Aç</a>
            </div>
          `);
        });
      });
    }
  </script>
</body>
</html>
