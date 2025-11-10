// ilan.page.js — İlan detay sayfası
// - Görsel(ler), açıklama, fiyat
// - Satıcı bilgisi (isim, avatar, doğrulama)
// - Sipariş / Mesaj butonları -> giriş zorunlu (login sonrası aynı ilana döner)

(function () {
  // ——— Ayarlar / Sabitler ———
  const PLACEHOLDER = '/assets/img/avatar-default.png';

  // TRY fiyat formatı
  const fmtTRY = (v) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(Number(v || 0));

  // Kısa yardımcılar
  const $ = (s) => document.querySelector(s);

  // ——— Firestore okuma yardımcıları ———
  async function getListing(id) {
    try {
      const s = await firebase.getDoc(`listings/${id}`);
      return s.exists() ? Object.assign({ id }, s.data() || {}) : null;
    } catch {
      return null;
    }
  }

  async function getSeller(uid) {
    // UID yoksa varsayılan satıcı
    if (!uid) return { name: 'Satıcı', avatar: PLACEHOLDER, verified: false, city: '' };

    try {
      const s = await firebase.getDoc(`users/${uid}`);
      if (!s.exists()) return { name: 'Satıcı', avatar: PLACEHOLDER, verified: false, city: '' };

      const d = s.data() || {};
      // İsim: name + surname (varsa) → yoksa displayName → yoksa 'Satıcı'
      const name =
        [d.name || d.firstName || '', d.surname || d.lastName || '']
          .filter(Boolean)
          .join(' ') || d.displayName || 'Satıcı';

      // Avatar: avatar → photoURL → PLACEHOLDER
      const avatar = d.avatar || d.photoURL || PLACEHOLDER;

      // Doğrulama: isVerified (sende bu var) veya verified
      const verified = !!(d.isVerified || d.verified);

      const city = d.district || d.city || d.province || '';

      return { name, avatar, verified, city };
    } catch {
      return { name: 'Satıcı', avatar: PLACEHOLDER, verified: false, city: '' };
    }
  }

  // ——— Görsel yardımcıları ———
  function setBg(el, url) {
    if (!el) return;
    if (url) {
      el.style.backgroundImage = `url('${url}')`;
      el.classList.remove('placeholder');
      el.textContent = '';
    } else {
      el.classList.add('placeholder');
      el.style.backgroundImage = 'none';
      el.textContent = 'Görsel yok';
    }
  }

  // ——— Auth gerektiren aksiyonlar ———
  function requireAuthThen(fn) {
    const cu = (window.__fb && window.__fb.auth && window.__fb.auth.currentUser) || null;
    if (cu) {
      fn();
      return;
    }
    alert('Devam etmek için giriş yapmalısınız.');
    const url = `/index.html?auth=login&redirect=${encodeURIComponent(location.href)}`;
    location.href = url;
  }

  // ——— Rozet/etiket HTML yardımcıları ———
  function badgeHTML(l) {
    const badges = [];

    // Vitrin (showcase / showcasePending)
    if (l.showcase === true) {
      badges.push(`<span class="badge star">⭐ Vitrin</span>`);
    } else if (l.showcasePending === true) {
      badges.push(`<span class="badge">İncelemede</span>`);
    }

    // Kategori
    const cat = l.category || l.subcategory || '';
    if (cat) badges.push(`<span class="badge">${String(cat)}</span>`);

    return badges.join(' ');
  }

  // ——— Ana akış ———
  async function boot() {
    // URL'den ?id parametresi
    const url = new URL(location.href);
    const id = url.searchParams.get('id');
    if (!id) {
      const t = $('#title');
      if (t) t.textContent = 'İlan bulunamadı';
      return;
    }

    // İlanı getir
    const l = await getListing(id);
    if (!l) {
      const t = $('#title');
      if (t) t.textContent = 'İlan kaldırılmış veya mevcut değil';
      return;
    }
    // Eğer ilan onaylı değilse ve kullanıcı admin veya ilan sahibi değilse gösterme
const cu = window.__fb?.auth?.currentUser;
const isOwner = cu && l.sellerId && cu.uid === l.sellerId;
const isAdmin = cu && cu.email && cu.email.endsWith('@ureteneller.com');
if (l.status !== 'approved' && !isOwner && !isAdmin) {
  const t = $('#title');
  if (t) t.textContent = 'Bu ilan henüz onaylanmadı.';
  document.body.innerHTML = '<h2 style="text-align:center;margin-top:3rem;">Bu ilan henüz onaylanmadı.</h2>';
  return;
}

    // Başlık
    const titleEl = $('#title');
    if (titleEl) titleEl.textContent = l.title || 'İlan';

    // Fiyat
    const priceEl = $('#price');
    if (priceEl && l.price != null) priceEl.textContent = fmtTRY(l.price);

    // Açıklama
    const descEl = $('#desc');
    if (descEl) descEl.textContent = l.description || 'Açıklama yok';

    // Rozetler
    const badgesEl = $('#badges');
    if (badgesEl) badgesEl.innerHTML = badgeHTML(l);

    // Görseller
    const main = $('#mainImg'); // ana görsel kutusu (div.thumb gibi arka planlı)
    const thumbs = $('#thumbs'); // küçük önizleme alanı (opsiyonel)

    // Senin şemana göre: önce photos[], yoksa images[], yoksa coverUrl
    const imagesRaw = Array.isArray(l.photos) && l.photos.length
      ? l.photos
      : Array.isArray(l.images) && l.images.length
      ? l.images
      : (l.coverUrl ? [l.coverUrl] : []);

    const images = (imagesRaw || []).filter(Boolean);

    setBg(main, images[0] || PLACEHOLDER);

    if (thumbs) {
      thumbs.innerHTML = '';
      images.forEach((src) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.style.padding = '.35rem .6rem';
        b.textContent = 'Görsel';
        b.addEventListener('click', () => setBg(main, src));
        thumbs.appendChild(b);
      });
    }

    // Satıcı bilgisi
    const uid =
      l.sellerId ||
      l.ownerUid ||
      l.userId ||
      l.ownerId ||
      l.uid ||
      l.createdBy ||
      l.userid ||
      l.userID ||
      null;

    const seller = await getSeller(uid);

    const sName = $('#sellerName');
    if (sName) sName.textContent = seller.name;

    const sBadge = $('#sellerBadge');
    if (sBadge) {
      sBadge.textContent = seller.verified ? 'Onaylı Satıcı' : 'Satıcı';
      if (seller.verified) sBadge.classList.add('verified');
    }

    const sCity = $('#sellerCity');
    if (sCity) sCity.textContent = seller.city || '';

    // Eğer sayfanda satıcı avatarı için bir eleman varsa (#sellerAvatar),
    // div.avatar gibi bir şeyse background-image uygula; <img> ise src ver.
    const sAvatar = $('#sellerAvatar');
    if (sAvatar) {
      if (sAvatar.tagName === 'IMG') {
        sAvatar.src = seller.avatar || PLACEHOLDER;
        sAvatar.alt = seller.name || 'Satıcı';
      } else {
        sAvatar.style.backgroundImage = `url('${seller.avatar || PLACEHOLDER}')`;
      }
    }

    // Aksiyonlar
    const btnOrder = $('#btnOrder');
    const btnMsg = $('#btnMsg');

    if (btnOrder) {
      btnOrder.onclick = () =>
        requireAuthThen(() => {
          alert('Sipariş akışı burada başlatılabilir.');
          // TODO: sipariş akışına yönlendir
        });
    }

    if (btnMsg) {
      btnMsg.onclick = () =>
        requireAuthThen(() => {
          alert('Mesajlaşma akışı burada başlatılabilir.');
          // TODO: mesajlaşma sayfasına yönlendir
        });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
