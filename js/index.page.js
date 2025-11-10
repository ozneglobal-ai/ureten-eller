// index.page.js — ana sayfa: header butonları, kategori slider (5sn), ilan ızgarası (vitrin üstte), redirect

// Bağımlılıklar: firebase-init.js (global: auth, db, firebase.getDocs, firebase.q, where, orderBy, limit, collection)

(function(){
  const COLORS = ["#10b981","#f59e0b","#8b5cf6","#06b6d4","#ef4444","#eab308","#14b8a6","#f97316","#a855f7","#3b82f6"];
  const PLACEHOLDER = '/assets/img/avatar-default.png'; // Kapak yoksa dummy

  // Kategori & Slogan veri seti (ikonlar inline SVG üretilecek)
  const CATS = [
    { key:"food",   title:"🍲 Yemekler" },
    { key:"cake",   title:"🎂 Pasta & Tatlı" },
    { key:"jar",    title:"🫙 Reçel • Turşu • Sos" },
    { key:"winter", title:"🌾 Yöresel / Kışlık" },
    { key:"diet",   title:"🥗 Diyet / Vegan / Glutensiz" },
    { key:"jew",    title:"💍 Takı" },
    { key:"kid",    title:"👶 Bebek & Çocuk" },
    { key:"knit",   title:"🧶 Örgü / Triko" },
    { key:"sew",    title:"✂️ Dikiş / Terzilik" },
    { key:"mac",    title:"🧵 Makrome & Dekor" },
    { key:"home",   title:"🏠 Ev Dekor & Aksesuar" },
    { key:"candle", title:"🕯️ Mum & Kokulu" },
    { key:"soap",   title:"🧼 Doğal Sabun & Kozmetik" },
    { key:"toys",   title:"🧸 Amigurumi & Oyuncak" },
  ];

  // Her kategori için 5–6 TR slogan (isteğin doğrultusunda)
  const SLOGANS = {
    food:   ["Komşundan al, sıcak sofralar","Ev yapımı lezzet, katkısız","Tencere sıcak, gönül rahat","Mahallenin ustaları","Mevsiminde, doğal tat"],
    cake:   ["Komşundan al, ev yapımı olsun","Şeker tadında kutlamalar","Doğum gününe hazır","Pastada ustalık, fiyatta samimiyet","Tatlı yiyelim, el emeği konuşsun","Organik dokunuş"],
    jar:    ["Mevsimi kavanozda sakla","Katkısız, geleneksel tarif","Annenin reçeli gibi","Turşusu tam kıvamında","Kışa güvenle gir"],
    winter: ["Kışlıklar hazır, içiniz sıcak","Yöresel tat, ev usulü","Erişte-tarhana dolapta","Kiler bereketi el emeğiyle","Sofrada gelenek var"],
    diet:   ["Hafif, lezzetli, dengeli","Glutensiz seçenek bol","Vegan dostu menüler","Şekersiz tatlılarla mutlu ol","Formu koru, tat kaçmasın"],
    jew:    ["Gerçek el emeği şıklık","Sade, zarif, kişiye özel","Her gün tak, farklı parıltı","Doğal taşın enerjisi","Hediye et, mutlu et"],
    kid:    ["Minikler için güvenli","Yumuşacık dokunuşlar","Montessori ruhu evinde","Hediye kutusunda sevgi","Oyuncakta el emeği kalite"],
    knit:   ["Gerçek el emeği, sıcak dokunuş","Cıcacık kazağın olsun","Her ilmekte özen","Kışa hazır kombin","Ömürlük örgüler"],
    sew:    ["İğne iplikte ustalık","Tamir et, değerlendir","Özel dikimle tam üzerinize","Ev tekstilinde estetik","Kostüme el işçiliği"],
    mac:    ["Duvarda zarafet","Her düğümde tasarım","Bitkine şık yuva","Minimal dekor, büyük etki","El düğümü, büyük stil"],
    home:   ["Evin ruhu detayda","El emeği ile sıcak mekan","Kapında şıklık, içeride huzur","Dekorda mahallenin ustası","Hediyelikte benzersiz seçim"],
    candle: ["Kokusu huzur, ışığı sıcak","Soya & balmumu doğallığı","El yapımı hediye hazır","Evin havası değişsin","Dinlendirici notalar"],
    soap:   ["Doğal yağlarla nazik bakım","Zeytinyağı ile arın","Lavanta kokusunda huzur","Katkısız temizlik","Cilt dostu sabunlar"],
    toys:   ["Sevgiyle örüldü","Koleksiyonluk figürler","Dekorda şirin dokunuş","Miniklere güvenli hediye","El emeği karakterler"]
  };

  // Basit inline SVG arka planı (renkli kutu)
  function catIcon(color="#3b82f6"){
    return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="${color}" opacity="0.15"></rect>
      <path d="M8 12h8M12 8v8" stroke="${color}" stroke-width="2" stroke-linecap="round"></path>
    </svg>`;
  }

  // --- Header butonları (login/signup) ---
  function wireHeader(){
    const btnLogin = document.querySelector('[data-act="open-login"]');
    const btnSignup = document.querySelector('[data-act="open-signup"]');
    const langSel = document.querySelector('#langSel');

    if(btnLogin){ btnLogin.onclick = ()=> openAuth('login'); }
    if(btnSignup){ btnSignup.onclick = ()=> openAuth('signup'); }
    if(langSel){ langSel.onchange = ()=> localStorage.setItem('ue_lang', langSel.value); }
  }
  function openAuth(which='login'){
    // index.html’de auth panelini göstereceğiz; şu an sayfadaysak event yayınla
    const e = new CustomEvent('ue-open-auth', { detail:{ which } });
    document.dispatchEvent(e);
    // Eğer bu sayfada yoksa, ana sayfaya auth paramıyla git
    const hasAuthPanel = !!document.getElementById('authBox');
    if(!hasAuthPanel){
      const redirect = location.pathname.includes('ilan.html') ? location.href : '';
      const url = `/index.html?auth=${which}&redirect=${encodeURIComponent(redirect)}`;
      location.href = url;
    }
  }

  // --- Kategori slider ---
  let __catTick = 0, __catInt = null;
  function renderCatSlider(){
    const holder = document.getElementById('catSlider');
    if(!holder) return;
    holder.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'cat-track';
    holder.appendChild(track);

    CATS.forEach((c, i)=>{
      const col = COLORS[i % COLORS.length];
      const card = document.createElement('div');
      card.className = 'cat-card';
      card.innerHTML = `
        <div class="cat-ico" style="background:${col}10">${catIcon(col)}</div>
        <div class="cat-info">
          <div class="cat-title">${c.title}</div>
          <div class="cat-slogan">${(SLOGANS[c.key]||[])[0]||''}</div>
        </div>`;
      card.dataset.key = c.key;
      track.appendChild(card);
    });

    // 5sn’de bir slogan ve renk kaydır
    function paint(){
      const cards = [...track.children];
      cards.forEach((card, i)=>{
        const key = card.dataset.key;
        const arr = SLOGANS[key]||[];
        const msg = arr.length ? arr[(__catTick+i)%arr.length] : '';
        const col = COLORS[(__catTick+i)%COLORS.length];
        const ico = card.querySelector('.cat-ico');
        const slog = card.querySelector('.cat-slogan');
        if(ico){ ico.style.background = `${col}10`; ico.innerHTML = catIcon(col); }
        if(slog){ slog.textContent = msg; }
      });
      __catTick = (__catTick + 1) % 10000;
    }
    paint();
    clearInterval(__catInt);
    __catInt = setInterval(paint, 5000);

    // Kategori tıklama → listeyi o kategoriye filtrelemek (basitçe anchor)
    track.addEventListener('click', (e)=>{
      const card = e.target.closest('.cat-card');
      if(!card) return;
      const key = card.dataset.key;
      // Basit filtre: URL param ile yenile
      const url = new URL(location.href);
      url.searchParams.set('cat', key);
      history.replaceState(null,'',url.toString());
      loadListings(); // filtrele
    });
  }

  // --- İlanlar (vitrin üstte, toplam 40; sonra "Daha fazla") ---
  let __lastCursorFeatured=null, __lastCursorDefault=null, __loadedCount=0;
  const PAGE_FIRST = 40;
  const PAGE_NEXT = 20;

  async function fetchListingsChunk({ featured=false, after=null, cat=null, size=20 }){
  const col = firebase.col('listings');
  const conds = [];

  // Kategori filtresi
  if (cat) conds.push(firebase.where('category', '==', cat));

  // Sadece onaylı (approved) ilanlar
  conds.push(firebase.where('status', '==', 'approved'));

  // "featured" için server tarafı filtre:
  // - featured === true ise yalnız vitrinleri çek
  // - değilse (false) server tarafında filtreleme yapmıyoruz; client'ta eleyeceğiz
  if (featured === true) {
    conds.push(firebase.where('featured', '==', true));
  }

  // En yeni ilk
  conds.push(firebase.orderBy('createdAt', 'desc'));

  // Sorgu
  const q = firebase.q(col, ...conds, firebase.limit(size));
  const snap = await firebase.getDocs(q);

  // Sonuçları toparla
  let rows = [];
  snap.forEach(ds => {
    const d = ds.data() || {};
    rows.push({ id: ds.id, ...d });
  });

  // Güvenli taraf: featured=false çağrısında vitrinleri ekarte et (duplikeleri önlemek için)
  if (featured !== true) {
    rows = rows.filter(r => r.featured !== true);
  }

  // (Not) 'after' paramı şu an kullanılmıyor; projende 'startAfter' hazırsa burada ekleyebilirsin.
  return rows;
}
  
  function listingCard(l){
    const url = `/ilan.html?id=${encodeURIComponent(l.id)}`;
    const img = l.coverImage || (Array.isArray(l.images)&&l.images[0]) || PLACEHOLDER;
    const price = (l.price!=null) ? `${l.price} ₺` : '';
    const root = document.createElement('article');
    root.className = 'card';
    root.innerHTML = `
      <a class="thumb" href="${url}" style="background-image:url('${img}')">
        <div class="placeholder" aria-hidden="true" style="display:${img? 'none':'grid'}">Görsel yok</div>
      </a>
      <div class="meta">
        <div class="title">${l.title||'İlan'}</div>
        ${price ? `<div class="price">${price}</div>`:''}
        <div class="badges">
          ${l.featured? `<span class="badge gold">Vitrin</span>`:''}
          <span class="badge blue">${(l.category||'kategori').toString()}</span>
          <span class="badge" data-seller="${l.sellerId||''}">Satıcı</span>
        </div>
      </div>
      <div class="actions">
        <a class="btn" href="${url}">İncele</a>
        <button class="btn primary" data-order="${l.id}">Sipariş ver</button>
      </div>
    `;
    // Order butonu auth yoksa login’e yönlendirsin
    root.querySelector('[data-order]')?.addEventListener('click',(e)=>{
      e.preventDefault();
      requireAuthThen(() => { location.href = url; }, url);
    });
    // Onaylı satıcı rozetini yükle
    (async ()=>{
      const el = root.querySelector('[data-seller]');
      const ok = await resolveVerified(l.sellerId);
      if(ok && el){ el.textContent = 'Onaylı Satıcı'; el.classList.add('green','badge'); }
    })();
    return root;
  }

  async function loadListings(initial=true){
    const wrap = document.getElementById('listingGrid');
    const badge = document.getElementById('listNote');
    if(!wrap) return;

    const url = new URL(location.href);
    const cat = url.searchParams.get('cat') || null;

    if(initial){ wrap.innerHTML=''; __loadedCount=0; }

    // Önce vitrin (featured), sonra diğerleri
    const need = initial ? PAGE_FIRST : PAGE_NEXT;

    const featuredRows = await fetchListingsChunk({ featured:true, cat, size:need });
    const restNeed = Math.max(0, need - featuredRows.length);
    const normalRows = restNeed ? await fetchListingsChunk({ featured:false, cat, size:restNeed }) : [];

    const rows = [...featuredRows, ...normalRows];
    rows.forEach(r => wrap.appendChild(listingCard(r)));
    __loadedCount += rows.length;

    // “Daha fazla” buton
    const more = document.getElementById('btnMore');
    if(more){
      more.style.display = rows.length < need ? 'none' : 'inline-flex';
    }

    if(badge){
      badge.textContent = cat ? `Filtre: ${cat} • Gösterilen: ${__loadedCount}` : `Gösterilen: ${__loadedCount}`;
    }
  }

  function requireAuthThen(fn, redirectUrl){
    if(auth?.currentUser){ fn(); return; }
    alert("Sipariş vermek için giriş yapmalısınız.");
    const url = `/index.html?auth=login&redirect=${encodeURIComponent(redirectUrl || location.href)}`;
    location.href = url;
  }

  // URL ile gelen auth/redirect paramlarını işleyelim (index.html bu eventi dinleyecek)
  function handleAuthParams(){
    const url = new URL(location.href);
    const authOpen = url.searchParams.get('auth'); // login | signup
    const redirect = url.searchParams.get('redirect');
    if(authOpen){
      const ev = new CustomEvent('ue-open-auth', { detail: { which: authOpen, redirect }});
      document.dispatchEvent(ev);
    }
  }

  // “Daha fazla” butonu
  function wireMore(){
    const more = document.getElementById('btnMore');
    if(more) more.onclick = ()=> loadListings(false);
  }

  // Boot
  function boot(){
    wireHeader();
    renderCatSlider();
    wireMore();
    loadListings(true);
    handleAuthParams();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else boot();

})();
