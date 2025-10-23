// ilan.page.js — ilan detay: görsel, açıklama, fiyat, satıcı bilgisi; Sipariş/mesaj -> auth zorunlu, login sonrası aynı ilan

(function(){

  const PLACEHOLDER = '/assets/img/avatar-default.png';

  async function getListing(id){
    try{
      const s = await firebase.getDoc(`listings/${id}`);
      return s.exists() ? Object.assign({id}, s.data()||{}) : null;
    }catch{ return null; }
  }

  async function getSeller(uid){
    if(!uid) return { name:'Satıcı', avatar: PLACEHOLDER, verified:false };
    try{
      const s = await firebase.getDoc(`users/${uid}`);
      if(!s.exists()) return { name:'Satıcı', avatar: PLACEHOLDER, verified:false };
      const d = s.data()||{};
      const name = [d.name||d.firstName||'', d.surname||d.lastName||''].filter(Boolean).join(' ') || d.displayName || 'Satıcı';
      return { name, avatar: d.avatar||d.photoURL||PLACEHOLDER, verified: !!d.verified };
    }catch{ return { name:'Satıcı', avatar: PLACEHOLDER, verified:false }; }
  }

  function setBg(el, url){
    if(!el) return;
    if(url){ el.style.backgroundImage = `url('${url}')`; }
    else { el.classList.add('placeholder'); el.textContent = 'Görsel yok'; }
  }

  function requireAuthThen(fn){
    if(auth?.currentUser){ fn(); return; }
    alert("Devam etmek için giriş yapmalısınız.");
    const url = `/index.html?auth=login&redirect=${encodeURIComponent(location.href)}`;
    location.href = url;
  }

  async function boot(){
    const url = new URL(location.href);
    const id = url.searchParams.get('id');
    if(!id){
      document.getElementById('title').textContent = 'İlan bulunamadı';
      return;
    }

    const l = await getListing(id);
    if(!l){
      document.getElementById('title').textContent = 'İlan kaldırılmış veya mevcut değil';
      return;
    }

    // Başlık & fiyat
    document.getElementById('title').textContent = l.title || 'İlan';
    if(l.price!=null) document.getElementById('price').textContent = `${l.price} ₺`;

    // Görseller
    const main = document.getElementById('mainImg');
    const thumbs = document.getElementById('thumbs');
    const images = (Array.isArray(l.images) && l.images.length ? l.images : [l.coverImage]).filter(Boolean);
    setBg(main, images[0] || PLACEHOLDER);
    if(thumbs){
      thumbs.innerHTML = '';
      images.forEach(src=>{
        const t = document.createElement('button');
        t.className='btn';
        t.textContent='Görsel';
        t.onclick=()=> setBg(main, src);
        thumbs.appendChild(t);
      });
    }

    // Açıklama
    document.getElementById('desc').textContent = l.description || 'Açıklama yok';

    // Kategori / rozetler
    const badges = document.getElementById('badges');
    if(badges){
      badges.innerHTML = `
        ${l.featured? `<span class="badge gold">Vitrin</span>`:''}
        ${l.category? `<span class="badge blue">${l.category}</span>`:''}
      `;
    }

    // Satıcı
    const seller = await getSeller(l.sellerId);
    const sName = document.getElementById('sellerName');
    const sBadge = document.getElementById('sellerBadge');
    if(sName){ sName.textContent = seller.name; }
    if(sBadge){ sBadge.textContent = seller.verified ? 'Onaylı Satıcı' : 'Satıcı'; sBadge.classList.add(seller.verified?'green':''); }

    // Aksiyonlar
    const btnOrder = document.getElementById('btnOrder');
    const btnMsg   = document.getElementById('btnMsg');
    if(btnOrder) btnOrder.onclick = ()=> requireAuthThen(()=> alert('Sipariş akışı burada başlatılabilir.'));
    if(btnMsg)   btnMsg.onclick   = ()=> requireAuthThen(()=> alert('Mesajlaşma akışı burada başlatılabilir.'));
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else boot();

})();
