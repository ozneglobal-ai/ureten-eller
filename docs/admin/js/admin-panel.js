<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Profil • Üreten Eller</title>
  <meta name="description" content="Üyelik profili" />
  <link rel="icon" href="/assets/icons/favicon.png" />
  <style>
    :root{
      --bg1:#0b1220; --bg2:#0a0f1c; --card:#0e172a; --ink:#e5e7eb; --muted:#9ca3af;
      --accent:#22d3ee; --ok:#10b981; --warn:#f59e0b; --err:#ef4444; --brd:#1f2937
    }
    html,body{height:100%}
    body{margin:0; background:linear-gradient(180deg,var(--bg1),var(--bg2)); color:var(--ink);
         font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
    .container{max-width:960px; margin:64px auto; padding:0 16px}
    .card{background:var(--card); border:1px solid var(--brd); border-radius:16px; padding:20px; box-shadow:0 8px 30px rgba(0,0,0,.25)}
    .row{display:flex; gap:16px; align-items:center; flex-wrap:wrap}
    .col{flex:1 1 300px}
    .muted{color:var(--muted)}
    .badge{display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid var(--brd)}
    .badge.pro{border-color:var(--ok)}
    .kv{display:grid; grid-template-columns:160px 1fr; gap:8px 16px; margin-top:12px}
    .kv div.label{color:var(--muted)}
    .btn{appearance:none; border:none; background:var(--accent); color:#001018; padding:10px 14px; border-radius:10px; cursor:pointer; font-weight:600}
    .btn[disabled]{opacity:.6; cursor:default}
    img.avatar{width:112px; height:112px; border-radius:50%; object-fit:cover; border:2px solid var(--brd); background:#111}
    header.bar{position:fixed; top:0; left:0; right:0; height:56px; display:flex; align-items:center; padding:0 12px; gap:12px; background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0)); backdrop-filter:blur(6px)}
    .xbtn{margin-left:auto; width:36px; height:36px; border-radius:999px; border:1px solid rgba(255,255,255,.35); color:#fff; background:transparent; display:inline-grid; place-items:center; cursor:pointer}
    .xbtn:hover{background:rgba(255,255,255,.08)}
    a{color:var(--accent); text-decoration:none}
    .danger{background:var(--err); color:#fff}
    .grid{display:grid; grid-template-columns:1fr; gap:16px}
    @media (min-width:860px){ .grid{grid-template-columns:360px 1fr} }
    .sep{height:1px; background:var(--brd); margin:12px 0}
  </style>
</head>
<body>
  <header class="bar">
    <strong>Profil</strong>
    <button class="xbtn" title="Ana sayfa" onclick="location.href='/home.html'">✕</button>
  </header>

  <main class="container">
    <section id="profileCard" class="card">
      <div class="grid">
        <div class="row">
          <img id="avatar" class="avatar" src="" alt="Avatar" />
          <div class="col">
            <h2 id="displayName">—</h2>
            <div>
              <span id="roleBadge" class="badge">member</span>
              <span id="proBadge" class="badge pro" style="display:none">PRO</span>
              <span id="proLeft" class="muted"></span>
            </div>
            <div class="muted" id="uidText" style="margin-top:6px"></div>
          </div>
        </div>

        <div>
          <div class="kv">
            <div class="label">E-posta</div><div id="email">—</div>
            <div class="label">Şehir</div><div id="city">—</div>
            <div class="label">Telefon</div><div id="phone">—</div>
            <div class="label">Hakkında</div><div id="about">—</div>
          </div>
          <div class="sep"></div>
          <div class="row" id="adminRow" style="display:none">
            <button id="btnProToggle" class="btn">PRO VER (12 ay)</button>
            <button id="btnBanToggle" class="btn danger">Banla</button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script type="module">
    import { auth, db } from "/firebase-init.js";
    import {
      doc, getDoc, setDoc, serverTimestamp
    } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

    const el = (id)=>document.getElementById(id);
    const displayName = el('displayName');
    const email       = el('email');
    const phone       = el('phone');
    const city        = el('city');
    const about       = el('about');
    const avatar      = el('avatar');
    const roleBadge   = el('roleBadge');
    const proBadge    = el('proBadge');
    const proLeft     = el('proLeft');
    const uidText     = el('uidText');
    const adminRow    = el('adminRow');
    const btnPro      = el('btnProToggle');
    const btnBan      = el('btnBanToggle');

    const qsUid = new URLSearchParams(location.search).get('uid');

    function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
    function msToDays(ms){ return Math.max(0, Math.floor(ms/86400000)); }
    function tsToMs(ts){
      if (!ts) return 0;
      if (typeof ts === 'number') return ts;
      if (ts.seconds) return ts.seconds*1000;
      return 0;
    }
    function proLeftText(u){
      const untilMs = tsToMs(u.proUntil ?? u.premiumUntil);
      if (!untilMs || untilMs<=Date.now()) return '';
      const d = msToDays(untilMs - Date.now());
      return d>0 ? ` • AKTİF (${d}g)` : ' • AKTİF (bugün)';
    }

    async function loadAndRender(targetUid, me){
      const uSnap = await getDoc(doc(db,'users',targetUid));
      const u = uSnap.exists() ? uSnap.data() : {};

      // Render
      displayName.textContent = u.displayName || '—';
      email.textContent       = u.email || '—';
      phone.textContent       = u.phone || '—';
      city.textContent        = u.city || '—';
      about.textContent       = u.about || '—';
      avatar.src              = u.photoURL || '/assets/icons/ureteneller.png';
      roleBadge.textContent   = (u.role || 'member');
      uidText.textContent     = `UID: ${targetUid}`;

      const proTxt = proLeftText(u);
      if (proTxt){
        proBadge.style.display = '';
        proLeft.textContent = proTxt;
      }else{
        proBadge.style.display = 'none';
        proLeft.textContent = '';
      }

      // Admin kontrolleri
      let isAdmin = false;
      if (me){
        const meSnap = await getDoc(doc(db,'users',me.uid));
        isAdmin = meSnap.exists() && meSnap.data().role === 'admin';
      }

      // Admin ise butonları aç, etiketleri hazırla
      adminRow.style.display = isAdmin ? '' : 'none';
      if (isAdmin){
        const untilMs = tsToMs(u.proUntil ?? u.premiumUntil);
        btnPro.textContent = (untilMs > Date.now()) ? 'PRO KALDIR' : 'PRO VER (12 ay)';
        btnPro.dataset.state = (untilMs > Date.now()) ? 'off' : 'on';
        btnBan.textContent = u.banned ? 'Ban Kaldır' : 'Banla';
        btnBan.dataset.state = u.banned ? 'off' : 'on';

        btnPro.onclick = async ()=>{
          btnPro.disabled = true;
          try{
            if (btnPro.dataset.state === 'on'){
              const until = Date.now() + 365*24*60*60*1000;
              await setDoc(doc(db,'users',targetUid), { proUntil: until, updatedAt: serverTimestamp() }, { merge:true });
            }else{
              await setDoc(doc(db,'users',targetUid), { proUntil: 0, updatedAt: serverTimestamp() }, { merge:true });
            }
            await loadAndRender(targetUid, me);
          }catch(e){ alert('PRO işlemi başarısız.'); console.error(e); }
          finally{ btnPro.disabled = false; }
        };

        btnBan.onclick = async ()=>{
          btnBan.disabled = true;
          try{
            if (btnBan.dataset.state === 'on'){
              await setDoc(doc(db,'users',targetUid), { banned:true, updatedAt: serverTimestamp() }, { merge:true });
            }else{
              await setDoc(doc(db,'users',targetUid), { banned:false, updatedAt: serverTimestamp() }, { merge:true });
            }
            await loadAndRender(targetUid, me);
          }catch(e){ alert('Ban işlemi başarısız.'); console.error(e); }
          finally{ btnBan.disabled = false; }
        };
      }
    }

    auth.onAuthStateChanged(async (me)=>{
      // 1) Hedef UID: URL'deki uid VARSA onu kullan (ÖNEMLİ)
      let targetUid = qsUid || me?.uid || null;

      // 2) Güvenlik: Admin değilse ve başkasının profiline bakmaya çalışıyorsa engelle
      if (qsUid && me){
        const meSnap = await getDoc(doc(db,'users',me.uid));
        const isAdmin = meSnap.exists() && meSnap.data().role === 'admin';
        if (!isAdmin && me.uid !== qsUid){
          location.href = '/index.html'; // veya bir uyarı sayfası
          return;
        }
      }

      if (!targetUid){
        // oturum yok ve uid yok → girişe yönlendir
        location.href = '/index.html';
        return;
      }

      try{
        await loadAndRender(targetUid, me || null);
      }catch(e){
        console.error(e);
        alert('Profil yüklenemedi.');
      }
    });
  </script>
</body>
</html>
