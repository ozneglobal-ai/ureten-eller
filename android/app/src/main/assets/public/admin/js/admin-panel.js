<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ÜE • Admin Paneli</title>
  <meta name="description" content="Üreten Eller yönetim paneli" />
  <link rel="icon" href="/assets/icons/favicon.png" />
  <style>
    :root{ --bg1:#0b1220; --bg2:#0a0f1c; --card:#0e172a; --ink:#e5e7eb; --muted:#9ca3af; --accent:#22d3ee; --ok:#10b981; --warn:#f59e0b; --err:#ef4444; --brd:#1f2937 }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{margin:0;background:linear-gradient(180deg,var(--bg1),var(--bg2));color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
    header.top{height:56px;display:flex;align-items:center;gap:12px;padding:0 16px;background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0));backdrop-filter:blur(6px);position:sticky;top:0;z-index:5;border-bottom:1px solid rgba(255,255,255,.06)}
    .layout{display:grid;grid-template-columns:240px 1fr;min-height:calc(100vh - 56px)}
    nav.menu{border-right:1px solid var(--brd);padding:16px;background:rgba(0,0,0,.15)}
    nav.menu a{display:block;padding:10px 12px;border-radius:10px;color:var(--ink);text-decoration:none;cursor:pointer}
    nav.menu a:hover{background:rgba(255,255,255,.06)}
    nav.menu a.active{background:rgba(34,211,238,.12);color:#bff6ff;border:1px solid rgba(34,211,238,.35)}
    main.content{padding:20px}
    .section{display:none}
    .section.active{display:block}
    .card{background:var(--card);border:1px solid var(--brd);border-radius:16px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.25)}
    .muted{color:var(--muted)}
    .row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
    .space{height:16px}
    input[type="text"],select{background:transparent;border:1px solid var(--brd);color:var(--ink);padding:10px 12px;border-radius:10px;outline:none}
    button,.btn{appearance:none;border:none;background:var(--accent);color:#001018;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:600}
    .btn-xs{padding:6px 10px;font-size:12px}
    .btn-sm{padding:8px 12px;font-size:13px}
    .btn[disabled]{opacity:.6;cursor:default}
    .danger{background:var(--err);color:#fff}
    table{width:100%;border-collapse:collapse}
    th,td{padding:10px 8px;border-bottom:1px solid var(--brd);text-align:left}
    th{font-weight:600;color:#e8f3f5}
    td.actions{white-space:nowrap}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid var(--brd)}
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
      <section id="users" class="section card"></section>

      <!-- İLANLAR -->
      <section id="listings" class="section card"></section>

      <!-- SİPARİŞLER (placeholder) -->
      <section id="orders" class="section card">
        <h2>Siparişler</h2>
        <p class="muted">Sipariş akışı ve durumları burada görüntülenecek.</p>
      </section>

      <!-- MESAJLAR -->
      <section id="messages" class="section card"></section>

      <!-- BİLDİRİM (placeholder) -->
      <section id="alerts" class="section card">
        <h2>Bildirim</h2>
        <p class="muted">Sistem uyarıları ve bildirim ayarları.</p>
      </section>

      <!-- RAPORLAR (placeholder) -->
      <section id="reports" class="section card">
        <h2>Raporlar</h2>
        <p class="muted">Satış, kullanıcı ve trafik raporları.</p>
      </section>

      <!-- AYARLAR (placeholder) -->
      <section id="settings" class="section card">
        <h2>Ayarlar</h2>
        <p class="muted">Panel ve platform ayarları.</p>
      </section>
    </main>
  </div>

  <!-- TEK SCRIPT: Top-level await YOK, her şey init içinde; lazy-load + sağlam import -->
  <script type="module">
(function(){
  const ready = (fn)=> document.readyState==='loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();

  // --- Fallback (Canvas/önizleme için yerel stub modüller) ---
  const AdminUsersFallback = {
    async mountAdminUsers({ container }){
      if(!container) return;
      container.innerHTML = `
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
              <tr data-uid="demo1">
                <td>Örnek Kullanıcı</td>
                <td>demo@example.com</td>
                <td>—</td>
                <td>İstanbul</td>
                <td>—</td>
                <td class="actions">
                  <button class="btn-xs" data-action="pro12">PRO VER</button>
                  <button class="btn-xs danger" data-action="ban">Banla</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" style="margin-top:8px">Önizleme modu: Firebase bağlı değil, örnek veri gösteriliyor.</div>
      `;
    }
  };

  const AdminListingsFallback = {
    async mountAdminListings({ container }){
      if(!container) return;
      container.innerHTML = `
        <div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">
          <h2 style="margin-right:auto">İlanlar</h2>
          <select id="al-status"><option>Tümü</option></select>
          <input id="al-q" type="text" placeholder="Başlık / kullanıcı ara" />
          <button id="al-reload" class="btn-sm">Yenile</button>
        </div>
        <div class="space"></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>İlan</th><th>Satıcı</th><th>Fiyat</th><th>Durum</th><th>Vitrin</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody id="al-body">
              <tr data-id="l1">
                <td>Örnek Ürün</td>
                <td>Örnek Kullanıcı</td>
                <td>₺500</td>
                <td><span class="badge">Yayında</span></td>
                <td>—</td>
                <td class="actions">
                  <button class="btn-xs">Onayla</button>
                  <button class="btn-xs danger">Reddet</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="muted" style="margin-top:8px">Önizleme modu: Firebase bağlı değil, örnek veri gösteriliyor.</div>
      `;
    }
  };

  const AdminMessagesFallback = {
    async mountAdminMessages({ container }){
      if(!container) return;
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:320px 1fr;gap:12px">
          <div class="card" style="padding:12px">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
              <input id="am-q" type="text" placeholder="Kullanıcı / e‑posta ara" style="flex:1"/>
              <button id="am-reload" class="btn-sm">Yenile</button>
            </div>
            <div id="am-convs" style="display:grid;gap:8px;max-height:65vh;overflow:auto">
              <button class="conv" style="text-align:left;background:transparent;border:1px solid #1f2937;color:#e5e7eb;padding:10px;border-radius:10px">
                <strong>Örnek Kullanıcı</strong>
                <div class="muted">Merhaba, nasıl yardımcı olabilirim?</div>
              </button>
            </div>
          </div>
          <div class="card" style="padding:12px;display:flex;flex-direction:column">
            <div style="flex:1;overflow:auto">
              <div style="margin-bottom:8px">Örnek Kullanıcı: Merhaba 👋</div>
              <div style="text-align:right">Admin: Hoş geldiniz!</div>
            </div>
            <form style="display:flex;gap:8px">
              <input type="text" placeholder="Mesaj yazın…" style="flex:1"/>
              <button class="btn" type="button">Gönder</button>
            </form>
          </div>
        </div>
        <div class="muted" style="margin-top:8px">Önizleme modu: Firebase bağlı değil, örnek veri gösteriliyor.</div>
      `;
    }
  };

  ready(() => {
    // --- Sekme navigasyonu: Firebase'e bağlı değil, her zaman çalışır ---
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
        if (id === 'users'    && !window.__usersMounted)    mountUsers();
        if (id === 'listings' && !window.__listingsMounted) mountListings();
        if (id === 'messages' && !window.__messagesMounted) mountMessages();
      }
    }
    document.getElementById('sideMenu')?.addEventListener('click',(e)=>{
      const a = e.target.closest('a[data-target]');
      if(!a) return;
      e.preventDefault();
      const id=a.dataset.target||(a.getAttribute('href')||'').replace('#','');
      if(id) show(id);
    });

    const first = (location.hash || '#summary').replace('#','');
    show(first);

    // --- Firebase'i arkadan yükle, sonuçları globale bırak (üretimde çalışır) ---
    (async function loadFirebase(){
      const candidates = ['/firebase-init.js','./firebase-init.js','../firebase-init.js','/docs/firebase-init.js'];
      for (const p of candidates){
        try{
          const mod = await import(p + `?v=${Date.now()}`);
          if (mod?.db){ window.__fbReady = true; window.__db = mod.db; window.__auth = mod.auth; return; }
        }catch(_){/* canvas önizleme 404 olabilir */}
      }
      window.__fbReady = false; // önizleme modunda normal
    })();

    // --- Lazy mount fonksiyonları (import başarısızsa fallback çalışır) ---
    async function mountUsers(){
      window.__usersMounted = true;
      try{
        const m = await import('/admin/admin-users.js?v=' + Date.now());
        await m.mountAdminUsers({ container: document.getElementById('users') });
      }catch(e){ console.warn('users modülü yok, fallback kullanılıyor'); AdminUsersFallback.mountAdminUsers({ container: document.getElementById('users') }); }
    }
    async function mountListings(){
      window.__listingsMounted = true;
      try{
        const m = await import('/admin/admin-listings.js?v=' + Date.now());
        await m.mountAdminListings({ container: document.getElementById('listings') });
      }catch(e){ console.warn('listings modülü yok, fallback kullanılıyor'); AdminListingsFallback.mountAdminListings({ container: document.getElementById('listings') }); }
    }
    async function mountMessages(){
      window.__messagesMounted = true;
      try{
        const m = await import('/admin/admin-messages.js?v=' + Date.now());
        await m.mountAdminMessages({ container: document.getElementById('messages') });
      }catch(e){ console.warn('messages modülü yok, fallback kullanılıyor'); AdminMessagesFallback.mountAdminMessages({ container: document.getElementById('messages') }); }
    }
  });
})();
</script>
</body>
</html>
