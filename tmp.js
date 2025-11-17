  
  import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,      // 👈 redirect yerine popup
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    updateProfile,
    sendPasswordResetEmail,
    signOut
  } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

  import {
    getFirestore, doc, setDoc, getDoc, serverTimestamp
  } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

  const db = (self.__fb?.db) || getFirestore();

/** users/{uid} dokümanını oluşturur/günceller (idempotent) */
async function saveUserProfile(user, form = {}) {
  if (!user) return;
  const uid = user.uid;

  // mevcut mu?
  let exists = false;
  try {
    const s = await getDoc(doc(db, 'users', uid));
    exists = s.exists();
  } catch {}

  const payload = {
    uid,
    email: user.email || '',
    displayName: (form.name || user.displayName || '').toString().trim(),
    username: (form.username || '').toString().trim(),
    province: form.province || '',
    city: form.city || form.province || '',
    district: form.district || '',
    phoneNumber: user.phoneNumber || '',
    photoURL: user.photoURL || '',
    emailVerified: !!user.emailVerified,
    providerIds: (user.providerData || []).map(p => p.providerId),
    // ilk oluşturuluyorsa varsayılan roller
    ...(exists ? {} : { roles: { seller: true, buyer: true }, createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db, 'users', uid), payload, { merge: true });
}

/** Girişte profil yoksa sessizce oluşturur; varsa doğrulama bayrağını senkronlar */
async function ensureUserDoc(user) {
  if (!user) return;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await saveUserProfile(user, {});
    } else if (snap.data()?.emailVerified !== !!user.emailVerified) {
      await setDoc(ref, { emailVerified: !!user.emailVerified, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch {}
}

/** Google girişinden sonra province/district yoksa hızlıca al */
async function promptLocationIfMissingAndSave(user, { onDone } = {}) {
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    const d = snap.exists() ? snap.data() : {};
    const hasCity = (d?.province && String(d.province).trim()) || (d?.city && String(d.city).trim());
    const hasDistrict = d?.district && String(d.district).trim();

    if (hasCity && hasDistrict) { onDone?.(); return; }

    // Basit, bağımsız mini modal
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.35);z-index:9999';
    wrap.innerHTML = `
      <div style="width:min(520px,96vw);background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 30px 60px rgba(0,0,0,.15);overflow:hidden">
        <div style="padding:12px 14px;border-bottom:1px solid #eee;font-weight:800">Konumunu tamamla</div>
        <div style="padding:14px;display:grid;gap:10px">
          <div style="font-size:14px;color:#374151">İlanlar ve öneriler için il / ilçe bilgin gerekli.</div>
          <div style="display:grid;gap:8px">
            <label style="font-size:12px;color:#6b7280">İl</label>
            <input id="pl_prov" placeholder="Örn: İstanbul" style="border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:14px">
          </div>
          <div style="display:grid;gap:8px">
            <label style="font-size:12px;color:#6b7280">İlçe</label>
            <input id="pl_dist" placeholder="Örn: Kadıköy" style="border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:14px">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap">
            <button id="pl_skip" class="btn ghost" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-weight:800;background:#fff;cursor:pointer">Sonra</button>
            <button id="pl_save" class="btn gold" style="border:1px solid #b18a37;border-radius:12px;padding:10px 14px;font-weight:800;background:linear-gradient(180deg,#f7e7b5,#e8c972 40%,#d7b45d 55%,#caa552 80%,#b79343);cursor:pointer">Kaydet</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const prov = wrap.querySelector('#pl_prov');
    const dist = wrap.querySelector('#pl_dist');
    const bSave = wrap.querySelector('#pl_save');
    const bSkip = wrap.querySelector('#pl_skip');

    bSkip.addEventListener('click', () => { wrap.remove(); onDone?.(); });

    bSave.addEventListener('click', async () => {
      const p = (prov.value || '').trim();
      const di = (dist.value || '').trim();
      if (!p || !di) { alert('Lütfen il ve ilçe giriniz.'); return; }
      try {
        await saveUserProfile(user, {
          province: p, district: di
        });
      } catch {}
      wrap.remove();
      onDone?.();
    });
  } catch {
    onDone?.();
  }
}

// 🔒 Email doğrulaması yapılmadan /home.html içeriği görüntülenemesin
function guardHomePage(){
  const auth = getAuth();
  onAuthStateChanged(auth, async (u)=>{
    // hiç giriş yoksa → hiçbir panel açma
    if(!u){
      return;
    }

    // email/şifre ile giriş yaptıysa ve doğrulanmadıysa → içeriği kilitle
    const usesPassword = u.providerData?.some(p=>p.providerId==='password');
    await u.reload();
    if (usesPassword && !u.emailVerified){
      try { await sendEmailVerification(u); } catch {}
      // Sayfayı kilitle ve kullanıcıya doğrulama uyarısı göster
      document.querySelector('main')?.setAttribute('inert','');
      document.querySelector('main').style.filter = 'blur(4px)';
      if (!document.getElementById('verifyBanner')){
        const div = document.createElement('div');
        div.id = 'verifyBanner';
        div.style.cssText = 'max-width:1200px;margin:12px auto;padding:12px;border:1px solid #f59e0b;background:#fff7ed;border-radius:12px';
        div.innerHTML = currentLang==='en'
          ? '<strong>Verify your email</strong> to access this page. After clicking the link in your email, return here and press “I verified”. <button class="btn gold" id="iVerified">I verified</button>'
          : '<strong>Bu sayfaya erişmek için e-postanızı doğrulayın.</strong> E-postadaki linke tıkladıktan sonra buraya dönüp “Doğruladım”a basın. <button class="btn gold" id="iVerified">Doğruladım</button>';
        document.querySelector('.topbar')?.after(div);
        document.getElementById('iVerified')?.addEventListener('click', async ()=>{
          await u.reload();
          if (u.emailVerified){
            document.querySelector('main')?.removeAttribute('inert');
            document.querySelector('main').style.filter = '';
            div.remove();
          } else {
            alert(currentLang==='en'
              ? 'Still not verified. Please check your inbox/SPAM.'
              : 'Hâlâ doğrulanmadı. Lütfen gelen kutusu/Spam klasörünü kontrol edin.');
          }
        });
      }
      // openAuth?.();  ← kaldırıldı, otomatik açma yok
      return;
    }

    // Doğrulanmış → sayfa serbest
    document.querySelector('main')?.removeAttribute('inert');
    document.querySelector('main').style.filter = '';
  });
}
guardHomePage();

    /* ===== i18n – Metinler (KATEGORİLERE DOKUNMADAN) ===== */
    const I18N = {
      tr:{'app.title':'Üreten Eller • Ana Sayfa','app.name':'Üreten Eller',
          'hero.title':'El emeği & yerel lezzetler tek çatı altında',
          'hero.desc':'Üreten kadınlardan, ev yapımı lezzetlerden, el işi tasarımlardan alışveriş yapın. Konumunuza göre arayın, kategorilerden keşfedin.',
          'buttons.post':'İlan Ver','buttons.signin':'Giriş / Kayıt','buttons.signout':'Çıkış','buttons.browse':'Kategorileri Keşfet',
          'buttons.login':'Giriş Yap','buttons.forgot':'Şifremi Unuttum','buttons.google':'Google ile Giriş','buttons.register':'Kayıt Ol',
          'buttons.prev':'‹ Önceki','buttons.next':'Sonraki ›','buttons.order':'Sipariş Ver','buttons.message':'Satıcıya Yaz',
          'fields.email':'E-posta','fields.password':'Şifre','fields.password2':'Şifre (Tekrar)','fields.username':'Kullanıcı Adı','fields.fullname':'Ad Soyad','fields.province':'İl','fields.district':'İlçe',
          'auth.title':'Giriş Yap / Kayıt Ol','register.summary':'Hesabın yok mu? Kayıt ol',
          'hints.verify':'Kayıtla birlikte <strong>mail doğrulama</strong> gönderilir. Gelen kutusu ve <strong>SPAM</strong> klasörünü kontrol edin.',
          'list.title':'Yeni İlanlar','list.loading':'Yükleniyor…','list.range':'{start}-{end} / {total}',
          'legal.tos':'Kullanım Şartları','legal.privacy':'Gizlilik Politikası','legal.kvkk':'KVKK Aydınlatma','legal.community':'Topluluk Kuralları','legal.prohibited':'Yasaklı Ürünler','legal.distance':'Mesafeli Satış','legal.preinfo':'Ön Bilgilendirme','legal.delivery':'Teslimat/İade','legal.contact':'İletişim',
          'listing.title':'İlan Detayı','seller.verified':'Onaylı','seller.default':'Satıcı','ribbon.showcase':'Vitrin'},
      en:{'app.title':'Ureten Eller • Home','app.name':'Ureten Eller',
          'hero.title':'Handmade & local delights in one place',
          'hero.desc':'Shop from women producers, homemade delicacies, and crafts. Search by location or browse categories.',
          'buttons.post':'Post Listing','buttons.signin':'Sign In / Register','buttons.signout':'Sign Out','buttons.browse':'Browse Categories',
          'buttons.login':'Sign In','buttons.forgot':'Forgot Password','buttons.google':'Continue with Google','buttons.register':'Register',
          'buttons.prev':'‹ Previous','buttons.next':'Next ›','buttons.order':'Order','buttons.message':'Message Seller',
          'fields.email':'Email','fields.password':'Password','fields.password2':'Password (Repeat)','fields.username':'Username','fields.fullname':'Full Name','fields.province':'Province','fields.district':'District',
          'auth.title':'Sign In / Register','register.summary':'No account? Create one',
          'hints.verify':'A <strong>verification email</strong> will be sent. Please check your inbox and <strong>SPAM</strong>.',
          'list.title':'New Listings','list.loading':'Loading…','list.range':'{start}-{end} of {total}',
          'legal.tos':'Terms of Use','legal.privacy':'Privacy Policy','legal.kvkk':'KVKK Notice','legal.community':'Community Guidelines','legal.prohibited':'Prohibited Items','legal.distance':'Distance Sales','legal.preinfo':'Pre-Information','legal.delivery':'Delivery/Returns','legal.contact':'Contact',
          'listing.title':'Listing Detail','seller.verified':'Verified','seller.default':'Seller','ribbon.showcase':'Showcase'},
      de:{'app.title':'Ureten Eller • Startseite','app.name':'Ureten Eller',
          'hero.title':'Handgemachtes & lokale Köstlichkeiten an einem Ort',
          'hero.desc':'Kaufen Sie bei Produzentinnen, Hausmannskost und Handarbeiten. Nach Standort suchen oder Kategorien entdecken.',
          'buttons.post':'Anzeige aufgeben','buttons.signin':'Anmelden / Registrieren','buttons.signout':'Abmelden','buttons.browse':'Kategorien Entdecken',
          'buttons.login':'Anmelden','buttons.forgot':'Passwort Vergessen','buttons.google':'Mit Google Fortfahren','buttons.register':'Registrieren',
          'buttons.prev':'‹ Zurück','buttons.next':'Weiter ›','buttons.order':'Bestellen','buttons.message':'Nachricht an Verkäufer',
          'fields.email':'E-Mail','fields.password':'Passwort','fields.password2':'Passwort (Wiederholen)','fields.username':'Benutzername','fields.fullname':'Vollständiger Name','fields.province':'Provinz','fields.district':'Bezirk',
          'auth.title':'Anmelden / Registrieren','register.summary':'Kein Konto? Registrieren',
          'hints.verify':'Eine <strong>Bestätigungs-E-Mail</strong> wird gesendet. Prüfen Sie Posteingang und <strong>SPAM</strong>.',
          'list.title':'Neue Anzeigen','list.loading':'Lädt…','list.range':'{start}-{end} von {total}',
          'legal.tos':'Nutzungsbedingungen','legal.privacy':'Datenschutz','legal.kvkk':'KVKK Hinweis','legal.community':'Community-Regeln','legal.prohibited':'Verbotene Artikel','legal.distance':'Fernabsatz','legal.preinfo':'Vorabinfo','legal.delivery':'Lieferung/Rückgabe','legal.contact':'Kontakt',
          'listing.title':'Anzeigedetails','seller.verified':'Verifiziert','seller.default':'Verkäufer','ribbon.showcase':'Schaufenster'},
      ar:{'app.title':'أُنتجت الأيادي • الرئيسية','app.name':'أُنتجت الأيادي',
          'hero.title':'منتجات يدوية ومأكولات محلية في مكان واحد',
          'hero.desc':'تسوّق من المنتجين والمنتِجات والمأكولات المنزلية والأعمال اليدوية. ابحث حسب الموقع أو تصفح الفئات.',
          'buttons.post':'أنشئ إعلانًا','buttons.signin':'تسجيل الدخول / حساب جديد','buttons.signout':'تسجيل الخروج','buttons.browse':'استكشف الفئات',
          'buttons.login':'تسجيل الدخول','buttons.forgot':'نسيت كلمة المرور','buttons.google':'تابع باستخدام Google','buttons.register':'إنشاء حساب',
          'buttons.prev':'‹ السابق','buttons.next':'التالي ›','buttons.order':'اطلب الآن','buttons.message':'راسل البائع',
          'fields.email':'البريد الإلكتروني','fields.password':'كلمة المرور','fields.password2':'تأكيد كلمة المرور','fields.username':'اسم المستخدم','fields.fullname':'الاسم الكامل','fields.province':'الولاية','fields.district':'المنطقة',
          'auth.title':'تسجيل الدخول / إنشاء حساب','register.summary':'ليس لديك حساب؟ أنشئ واحدًا',
          'hints.verify':'سيتم إرسال <strong>بريد تحقق</strong>. افحص البريد الوارد و<strong>الرسائل المزعجة</strong>.',
          'list.title':'إعلانات جديدة','list.loading':'جارٍ التحميل…','list.range':'{start}-{end} من {total}',
          'legal.tos':'شروط الاستخدام','legal.privacy':'سياسة الخصوصية','legal.kvkk':'إشعار KVKK','legal.community':'قواعد المجتمع','legal.prohibited':'مواد محظورة','legal.distance':'البيع عن بُعد','legal.preinfo':'معلومات أولية','legal.delivery':'التسليم/الإرجاع','legal.contact':'اتصال',
          'listing.title':'تفاصيل الإعلان','seller.verified':'موثّق','seller.default':'البائع','ribbon.showcase':'مميّز'}
    };

    let currentLang = localStorage.getItem('ue_lang') || 'tr';
    // --- paylaşılan durum / API ---
window.UE = window.UE || {};
window.UE.I18N = I18N;
window.UE.getLang = () => currentLang;
window.UE.setLang = (lang) => {
  currentLang = lang;
  localStorage.setItem('ue_lang', lang);
  window.dispatchEvent(new CustomEvent('ue:lang', { detail: lang }));
};
    function t(key, vars){
      const dict = I18N[currentLang] || I18N.tr;
      let val = dict[key] ?? I18N.tr[key] ?? key;
      if (vars && typeof val === 'string'){
        Object.entries(vars).forEach(([k,v])=>{ val = val.replace(`{${k}}`, v); });
      }
      return val;
    }

    // ===== i18n – Kategori/Sözlükleri (SENDE NE VARSA AYNEN KALSIN) =====
const CAT_I18N = { /* ... (değişmedi) ... */ };

function applyI18n(lang) {
  currentLang = lang;
  window.UE?.setLang?.(lang);
  const dict = I18N[lang] || I18N.tr;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] != null) el.innerHTML = dict[key];
  });

  document.title = dict['app.title'] || document.title;
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

  // Placeholder metinleri
  document.getElementById('li_email')?.setAttribute('placeholder',
    lang === 'en' ? 'name@example.com' :
    lang === 'de' ? 'name@beispiel.de' :
    lang === 'ar' ? 'name@example.com' :
    'ornek@mail.com');

  document.getElementById('su_email')?.setAttribute('placeholder',
    lang === 'en' ? 'name@example.com' :
    lang === 'de' ? 'name@beispiel.de' :
    lang === 'ar' ? 'name@example.com' :
    'ornek@mail.com');

  document.getElementById('su_username')?.setAttribute('placeholder',
    lang === 'en' ? '@username' :
    lang === 'de' ? '@benutzer' :
    lang === 'ar' ? '@username' :
    '@kullanici');

  document.getElementById('su_name')?.setAttribute('placeholder',
    lang === 'en' ? 'Your full name' :
    lang === 'de' ? 'Vollständiger Name' :
    lang === 'ar' ? 'الاسم الكامل' :
    'Adınız Soyadınız');

  document.getElementById('su_district')?.setAttribute('placeholder',
    lang === 'en' ? 'Your district' :
    lang === 'de' ? 'Bezirk' :
    lang === 'ar' ? 'المنطقة' :
    'İlçeniz');

  buildTopCats(lang);
}

// Yıl ve il listesi
document.getElementById('y').textContent = new Date().getFullYear();

const PROVINCES = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan",
  "Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu",
  "Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ",
  "Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır",
  "Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri",
  "Kırıkkale","Kırklareli","Kırşehir","Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa",
  "Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun",
  "Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak",
  "Van","Yalova","Yozgat","Zonguldak"
].sort((a, b) => a.localeCompare(b, 'tr'));

const suProv = document.getElementById('su_province');
if (suProv) {
  suProv.innerHTML =
    '<option value="" disabled selected>İl seçiniz</option>' +
    PROVINCES.map(p => `<option value="${p}">${p}</option>`).join('');
}

    /* ===== KATEGORİLER – SENİN DOSYANDAN AYNEN ===== */
    const CATS = [ /* ... (değişmedi) ... */ ];

    const catBar = document.querySelector('#catNav .catnav-inner');
    const drops = document.querySelector('#catDrops .catdrops-inner');

    function localizeCat(cat, lang){
      const L = CAT_I18N[lang] || CAT_I18N.tr || {titles:{},subs:{}};
      const title = (L.titles && L.titles[cat.id]) || cat.title || cat.id;
      const subs = (cat.subs||[]).map(([sid, sLabel])=>[sid, (L.subs && L.subs[sid]) || sLabel || sid]);
      return { id: cat.id, title, subs };
    }

    function buildTopCats(lang){
      const current = lang || (localStorage.getItem('ue_lang') || 'tr');
      catBar.innerHTML = '';
      drops.innerHTML = '';
      (CATS||[]).forEach((cat)=>{
        const LCat = localizeCat(cat, current);
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.type = 'button';
        chip.textContent = LCat.title;
        chip.dataset.target = `p_${LCat.id}`;

        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.id = `p_${LCat.id}`;
        panel.innerHTML = LCat.subs.map(([id,label])=>`<a href="#" data-open-auth style="display:inline-block;margin:4px 6px;padding:8px 10px;border-radius:8px;border:1px solid #eee">${label}</a>`).join('');
        panel.addEventListener('click',(e)=>{ if(e.target.matches('a[data-open-auth]')){ e.preventDefault(); openAuth(); }});

        chip.addEventListener('click',()=>{
          const wasOpen = panel.classList.contains('open');
          document.querySelectorAll('.catdrops .panel.open').forEach(p=>p.classList.remove('open'));
          document.querySelectorAll('#catNav .chip.active').forEach(c=>c.classList.remove('active'));
          if (!wasOpen){
            panel.classList.add('open');
            chip.classList.add('active');
          }
        });

        catBar.appendChild(chip);
        drops.appendChild(panel);
      });
    }

    buildTopCats(localStorage.getItem('ue_lang')||'tr');

    const authModal = document.getElementById('authModal');

function openAuth(){
  if (authModal && typeof authModal.showModal === 'function'){
    authModal.showModal();
  } else if (authModal) {
    authModal.setAttribute('open','');
    authModal.style.display = 'grid';
  }
}

window.openAuth = openAuth; // diğer scriptler için global erişim

   function closeAuth(){
  if (typeof authModal.close === 'function') authModal.close();
}

document.querySelectorAll('#authModal [data-close]')
  .forEach(b => b.addEventListener('click', closeAuth));

document.getElementById('signInBtn')
  ?.addEventListener('click', openAuth);


    const langSel = document.getElementById('langSel');
    langSel?.addEventListener('change', (e)=>{
      const v = e.target.value;
      localStorage.setItem('ue_lang', v);
      applyI18n(v);
      // liste/içerik metinlerini güncelle
      if (typeof render === 'function') render();
    });
    applyI18n(localStorage.getItem('ue_lang')||'tr');

    document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click',()=>{
      const id = b.getAttribute('data-toggle'); const inp = document.getElementById(id);
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    }));

    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    function redirectHome(){ window.location.href = '/home.html'; }

   // Google ile giriş — popup (Android/WebView uyumlu)
document.getElementById('googleBtn')?.addEventListener('click', async () => {
  try {
    const result = await signInWithPopup(auth, provider);

    if (result && result.user) {
      try {
        await saveUserProfile(result.user, {});
      } catch (e) {
        console.warn('Profil kaydedilirken hata:', e);
      }
      redirectHome();
    }

  } catch (err) {
    console.error('Google sign-in error:', err);
    alert(
      currentLang === 'en'
        ? 'Google sign-in failed. Please try again.'
        : 'Google ile giriş başarısız oldu. Lütfen tekrar deneyin.'
    );
  }
});

    document.getElementById('loginBtn')?.addEventListener('click', async ()=>{
  const email = document.getElementById('li_email').value.trim();
  const pass  = document.getElementById('li_pass').value;

  if (!email || pass.length < 6) {
    alert(currentLang === 'en'
      ? 'Check email & password.'
      : 'E-posta ve şifreyi kontrol edin.');
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await cred.user.reload();

    // ✅ Sadece doğrulama uyarısı göster, PROFİL KAYDI YOK, TANIMSIZ DEĞİŞKEN YOK
    if (!cred.user.emailVerified) {
      try { await sendEmailVerification(cred.user); } catch {}
      alert(
        currentLang === 'en'
          ? 'Please verify your email before continuing. We sent you a verification email.'
          : 'Devam etmeden önce e-postanızı doğrulayın. Spam kutunuzu kontrol etmeyi unutmayın. Doğrulama e-postası gönderildi.'
      );
      return; // doğrulanmadan içeri alma
    }

    // ✅ Artık doğrulanmış kullanıcı → ana sayfaya geç
    redirectHome();
  } catch (err) {
    let msgTr;
    switch (err.code) {
      case 'auth/email-already-in-use':
        msgTr = 'Bu e-posta adresiyle zaten bir hesap mevcut. Lütfen giriş yapın.';
        break;
      case 'auth/invalid-email':
        msgTr = 'Geçersiz e-posta adresi.';
        break;
      case 'auth/user-not-found':
        msgTr = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        msgTr = 'E-posta veya şifre hatalı.';
        break;
      case 'auth/missing-password':
        msgTr = 'Lütfen bir şifre girin.';
        break;
      default:
        msgTr = 'Bir hata oluştu: ' + (err.message || err.code);
    }
    alert(msgTr);
  }
});

    document.getElementById('forgotBtn')?.addEventListener('click', async ()=>{
      const email = document.getElementById('li_email').value.trim();
      if(!email){ alert(currentLang==='en'?'Enter your email to reset password.':'Şifre sıfırlamak için e-posta girin.'); return; }
      try{ await sendPasswordResetEmail(auth, email); alert(currentLang==='en'?'Password reset email sent. Check inbox/SPAM.':'Şifre sıfırlama e-postası gönderildi. Gelen kutusu ve SPAM klasörünü kontrol edin.'); }
      catch(err){
  let msgTr;
  switch (err.code) {
    case 'auth/user-not-found':
      msgTr = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
      break;
    case 'auth/invalid-email':
      msgTr = 'Geçersiz e-posta adresi.';
      break;
    case 'auth/too-many-requests':
      msgTr = 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.';
      break;
    case 'auth/network-request-failed':
      msgTr = 'Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.';
      break;
    default:
      msgTr = 'Bir hata oluştu: ' + (err.message || err.code);
  }
  alert(msgTr);
}
    });

    document.getElementById('registerBtn')?.addEventListener('click', async ()=>{
  const username = document.getElementById('su_username').value.trim();
  const name     = document.getElementById('su_name').value.trim();
  const province = document.getElementById('su_province').value;
  const district = document.getElementById('su_district').value.trim();
  const email    = document.getElementById('su_email').value.trim();
  const pass     = document.getElementById('su_pass').value;
  const pass2    = document.getElementById('su_pass2').value;

  if (!username || !name || !province || !district || !email || pass.length < 6 || pass !== pass2){
    alert(currentLang==='en' ? 'Please fill all fields correctly.' : 'Lütfen tüm alanları doğru doldurun.');
    return;
  }

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    // Doğrulama e-postası gönder
    try { await sendEmailVerification(cred.user); } catch {}
    await saveUserProfile(cred.user, { username, name, province, district });

    // Kullanıcıyı içeri almıyoruz; doğrulama zorunlu
    alert(currentLang==='en'
      ? 'Registration completed. Please verify your email. Check Inbox/SPAM.'
      : 'Kayıt tamamlandı. Lütfen e-postanızı doğrulayın. Gelen kutusu/Spam klasörünü kontrol edin.');

    // Oturumu kapat ki doğrulanmadan /home.html’a geçemesin
    try { await signOut(auth); } catch {}

    // İstersen giriş modali açık kalsın; yönlendirme YOK.
    // redirectHome();  ← kaldırıldı

  }catch(err){
  let msgTr;
  switch (err.code) {
    case 'auth/email-already-in-use':
      msgTr = 'Bu e-posta adresiyle zaten bir hesap mevcut. Lütfen giriş yapın.';
      break;
    case 'auth/invalid-email':
      msgTr = 'Geçersiz e-posta adresi.';
      break;
    case 'auth/weak-password':
      msgTr = 'Şifre en az 6 karakter olmalı.';
      break;
    case 'auth/operation-not-allowed':
      msgTr = 'Bu kayıt yöntemi şu anda izinli değil. Lütfen daha sonra tekrar deneyin.';
      break;
    case 'auth/network-request-failed':
      msgTr = 'Ağ hatası oluştu. İnternet bağlantınızı kontrol edin.';
      break;
    case 'auth/too-many-requests':
      msgTr = 'Çok fazla deneme yapıldı. Lütfen kısa bir süre sonra tekrar deneyin.';
      break;
    default:
      msgTr = 'Bir hata oluştu: ' + (err.message || err.code);
  }
  alert(msgTr);
}
});

    onAuthStateChanged(auth, (u)=>{
      const authArea = document.getElementById('authArea');
      const signBtn = document.getElementById('signInBtn');
      if (u){
        authArea.style.display='flex'; signBtn.style.display='none';
        document.getElementById('uName').textContent = u.displayName || u.email || (I18N[currentLang]['seller.default']||'Satıcı');
        document.getElementById('uAvatar').src = u.photoURL || '/assets/img/avatar-default.png';
      } else {
        authArea.style.display='none'; signBtn.style.display='inline-flex';
      }
    });

    document.getElementById('signOutBtn')?.addEventListener('click', async ()=>{ try{ await signOut(auth); }catch{} });
document.getElementById('browseBtn')?.addEventListener('click', () => {
  location.href = '/listings.html';
});

    document.getElementById('postBtn')?.addEventListener('click', openAuth);
  
  
    import { getFirestore, collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
    
    // paylaşılan sözlük ve dil
const I18N = (window.UE && window.UE.I18N) || {};
let currentLang = (window.UE && window.UE.getLang && window.UE.getLang()) || localStorage.getItem('ue_lang') || 'tr';

// dil değişince listeyi yeniden çiz
window.addEventListener('ue:lang', (e)=>{
  currentLang = e.detail || 'tr';
  render?.();
});


    const db2 = (self.__fb?.db) || getFirestore();
    const grid = document.getElementById('listGrid');
    const info = document.getElementById('listInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    const PAGE_SIZE = 40;
    let allListings = [];
    let page = 0;

    function formatPrice(tryAmount){
      try{
        const locale = currentLang==='de'?'de-DE':(currentLang==='en'?'en-US':(currentLang==='ar'?'ar-EG':'tr-TR'));
        return new Intl.NumberFormat(locale,{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(tryAmount);
      }catch{ return tryAmount + ' TL'; }
    }
  
// 🔧 İLAN KARTI: satıcı adı + avatar eklenmiş şablon (profil fallback'lı)
async function cardTpl(it){
  const imgList  = Array.isArray(it.photos) ? it.photos : [];
  const mainImg  = clMain(imgList[0]);
  const showcase = !!it.showcase;

  // YENİ
const priceTxt = (typeof it.price === 'number')
  ? formatPrice(it.price)
  : '';

  const title = (it.title || '—').toString();
  const id    = it.id;

  // --- Satıcı profilini gerektiğinde getir ---
  let prof = it.__sellerProfile || null;
  if (!it.sellerDisplayName && !it.sellerAvatarPublicId && !it.sellerAvatarUrl) {
    const uid = it.ownerUid || it.userId || it.uid || it.owner || it.sellerUid || null;
    if (uid && typeof self.getUserProfile === 'function') {
      try {
        prof = await self.getUserProfile(uid);
        it.__sellerProfile = prof || null; // sonraki kartlarda tekrar çekmesin
      } catch(e){ console.warn('[cardTpl] profil okunamadı:', uid, e); }
    }
  }

  // --- Ad & Avatar çözümleme (ilan + profil birleştir) ---
  let name = null, avatarPid = null, avatarUrl = null;
  if (typeof self.resolveSellerFields === 'function') {
    const resolved = self.resolveSellerFields(it, prof || {});
    name = resolved?.name || null;
    avatarPid = resolved?.avatarPid || null;
    avatarUrl = resolved?.avatarUrl || null;
  } else {
    // emniyetli fallback (resolveSellerFields yoksa)
    name =
      it.sellerDisplayName || it.sellerName || it.ownerName || it.username || it.name ||
      prof?.displayName || prof?.fullName || prof?.name || prof?.username || null;

    avatarPid =
      it.sellerAvatarPublicId || it.avatarPublicId || it.photoPublicId || it.avatarId || it.avatarPid ||
      prof?.sellerAvatarPublicId || prof?.avatarPublicId || prof?.photoPublicId || prof?.avatarPid || null;

    avatarUrl =
      it.sellerAvatarUrl || it.photoURL || it.avatarUrl ||
      prof?.sellerAvatarUrl || prof?.photoURL || prof?.avatarUrl || null;
  }

  const finalName = (name && String(name).trim()) || (window.UE?.I18N?.tr?.['seller.default'] || 'Satıcı');
  const finalAvatar =
    avatarPid ? (self.avatarUrl ? self.avatarUrl(avatarPid) : '') :
    avatarUrl ? (self.fetchThumb ? self.fetchThumb(avatarUrl) : avatarUrl) :
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2VlZWVlZSIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjIiIHI9IjExIiBmaWxsPSIjY2NjY2NjIi8+PHBhdGggZD0iTTMyIDM2Yy0xNiAwLTIyIDguNy0yMiAxMy4zIDAgMS44IDEuNSAzLjMgMy4zIDMuM2gzNy40YzEuOCAwIDMuMy0xLjUgMy4zLTMuMyAwLTQuNi02LTEzLjMtMjItMTMuM3oiIGZpbGw9IiNjY2NjY2MiLz48L3N2Zz4=';

  return `
    <article class="card" data-id="${id ?? ''}">
      <div class="ph">
        ${showcase ? `<span class="ribbon">${(I18N?.[currentLang]?.['ribbon.showcase'] || I18N?.tr?.['ribbon.showcase'] || 'Vitrin')}</span>` : ''}
        <img alt="${title}" loading="lazy" src="${mainImg}" width="800" height="550">
      </div>
      <div class="body">
        <div class="title">${title}</div>
        <div class="seller">
          <div class="av"><img alt="${finalName}" src="${finalAvatar}" width="22" height="22" style="border-radius:50%"></div>
          <div class="name" title="${finalName}">${finalName}</div>
        </div>
        <div class="price">${priceTxt}</div>
      </div>
    </article>`;
}

    // === REPLACE: async function fetchSeller(uid){ ... } ===
async function fetchSeller(uid){
  if (!uid) return null;
  try {
    const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
    // Ana koleksiyon
    let snap = await getDoc(doc(db2, 'users', uid));
    if (snap.exists()) return { _src: 'users', ...snap.data() };

    // Alternatif koleksiyon isimleri (bazı projelerde farklı olabiliyor)
    const altPaths = [
      ['profiles', uid],
      ['userProfiles', uid],
    ];
    for (const [col, id] of altPaths) {
      try {
        const s2 = await getDoc(doc(db2, col, id));
        if (s2.exists()) return { _src: col, ...s2.data() };
      } catch {}
    }
  } catch (_) {
    // Yetki yok / offline / başka hata — sessizce geç
    return null;
  }
  return null;
}

    function setListInfo(start, end, total){
      const txt = (I18N[currentLang]['list.range']||'{start}-{end} / {total}')
        .replace('{start}', start).replace('{end}', end).replace('{total}', total);
      info.textContent = txt;
    }

    // ---- Cloudinary yardımcıları (firebase-init.js global fonksiyonlarını kullanır) ----
const EMPTY_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function clMain(src){
  if (!src) return EMPTY_IMG;
  // Tam Cloudinary URL geldiyse (hangi cloud name olursa olsun) olduğu gibi kullan:
  if (/^https?:\/\/res\.cloudinary\.com\//.test(src)) return src;
  // Başka bir tam URL ise de fetch yapma, direkt göster:
  if (/^https?:\/\//.test(src)) return src;
  // Public ID ise kendi cloud'unda üret:
  return (window.clUrl?.(src, { c:'fill', w:800, h:550, q:'auto', f:'auto' }) || src);
}

function clThumb(src){
  if (!src) return EMPTY_IMG;
  // Tam Cloudinary URL geldiyse direkt kullan:
  if (/^https?:\/\/res\.cloudinary\.com\//.test(src)) return src;
  // Başka bir tam URL ise de fetch yapma:
  if (/^https?:\/\//.test(src)) return src;
  // Public ID ise kendi cloud'unda küçük görsel üret:
  return (window.clUrl?.(src, { c:'fill', w:120, h:120, q:'auto', f:'auto' }) || src);
}

function avatarFromSeller(s){
  const publicId = s?.avatarPublicId || s?.photoPublicId || s?.avatarId || s?.avatarPid;
  const url      = s?.sellerAvatarUrl || s?.photoURL || s?.avatarUrl;

  if (publicId && window.avatarUrl) return window.avatarUrl(publicId);

  if (url){
    // Cloudinary tam URL ise direkt kullan
    if (/^https?:\/\/res\.cloudinary\.com\//.test(url)) return url;
    // Diğer tam URL'ler için istersen kırp/fetch
    return window.clFetch?.(url, { c:'fill', w:60, h:60, q:'auto', f:'auto', radius:'max' }) || url;
  }

  return EMPTY_IMG;
}

    async function render(){
  const start = page * PAGE_SIZE;
  const slice = allListings.slice(start, start + PAGE_SIZE);
  const htmlArr = await Promise.all(slice.map(cardTpl)); // ← Promiseleri bekle
  grid.innerHTML = htmlArr.join('');
  setListInfo(allListings.length ? (start + 1) : 0, Math.min(start + PAGE_SIZE, allListings.length), allListings.length);
  prevBtn.disabled = page === 0;
  nextBtn.disabled = (start + PAGE_SIZE) >= allListings.length;
  prevBtn.textContent = I18N[currentLang]['buttons.prev'] || '‹ Önceki';
  nextBtn.textContent = I18N[currentLang]['buttons.next'] || 'Sonraki ›';
}

    grid.addEventListener('click', async (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.getAttribute('data-id');
  const listing = allListings.find(x => x.id === id);
  if (!listing) return;

  // "Sipariş" veya "Mesaj" butonuna basıldıysa
  if (e.target.matches('[data-do="order"], [data-do="msg"]')) {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert('Giriş yapmalısınız.');
      window.openAuth?.(); // giriş panelini aç
      return;
    }
    // Giriş yapılmışsa satıcı bilgilerini göster (veya ileride işlem yapılabilir)
  }

  // Kartın başka yerine tıklanırsa detay modalını aç
openListingDetail(listing, card.querySelector('.ph img')?.src);
}); 

// === REPLACE: async function openListingDetail(it, imgSrc){ ... } ===
async function openListingDetail(it, imgSrc) {
  const modal = document.getElementById('listingModal');
  const body  = document.getElementById('listingBody');

  // ——— Satıcı adı (sadece ilan dokümanından) ———
  const sName =
    (it.sellerDisplayName || it.sellerName || it.ownerName || it.username || it.name || '').toString().trim() ||
    (I18N?.[UE?.getLang?.() || 'tr']?.['seller.default'] || I18N?.tr?.['seller.default'] || 'Satıcı');

  // ——— Avatar (Cloudinary PID > Cloudinary upload URL > http URL > Storage path > inline SVG) ———
const p = it.__sellerProfile || {};

let pidFromDoc =
  it.sellerAvatarPublicId || it.avatarPublicId || it.photoPublicId || it.avatarId || it.avatarPid ||
  p.sellerAvatarPublicId || p.avatarPublicId || p.photoPublicId || p.avatarPid ||
  (p.photos && (p.photos.avatarPublicId || p.photos.avatarPid)) || null;

let urlFromDoc =
  it.sellerAvatarUrl || it.photoURL || it.avatarUrl || it.avatar ||
  p.sellerAvatarUrl || p.photoURL || p.avatarUrl || p.avatar || null;

// 1) Site asset yoluysa (assets/...) mutlak yap
if (urlFromDoc && /^\/?assets\//i.test(urlFromDoc)) {
  urlFromDoc = `${location.origin}/${urlFromDoc.replace(/^\//,'')}`;
}

// 2) Storage path ise (http değil ve assets/ değil) downloadURL'e çevir
if (
  urlFromDoc &&
  !/^https?:\/\//i.test(urlFromDoc) &&
  !/^\/?assets\//i.test(urlFromDoc) &&
  self.storageRef && self._getDownloadURL
) {
  try {
    const refObj = self.storageRef(urlFromDoc);
    urlFromDoc = await self._getDownloadURL(refObj);
  } catch { urlFromDoc = null; }
}

let sAv = '';
try {
  if (pidFromDoc && (self.avatarUrl || window.avatarUrl)) {
    // Cloudinary public_id için dönüştürülmüş avatar
    const makePidUrl = self.avatarUrl || window.avatarUrl;
    sAv = makePidUrl(pidFromDoc);
  } else if (urlFromDoc) {
    const cloud = (self.CLOUDINARY && self.CLOUDINARY.cloud) || 'dbntnzogo';
    const reClUpload = new RegExp(`^https?://res\\.cloudinary\\.com/${cloud}/image/upload/`);
    const tx = 'c_fill,w_60,h_60,r_max,q_auto,f_auto';

    if (reClUpload.test(urlFromDoc)) {
      // Cloudinary UPLOAD URL'ü ise FETCH kullanma — transformu /upload/ sonrasına enjekte et
      sAv = urlFromDoc.replace('/image/upload/', `/image/upload/${tx}/`);
    } else {
      // Normal http(s) URL — varsa Cloudinary fetch ile dönüştür
      const clFetchFn = self.clFetch || window.clFetch;
      sAv = clFetchFn
        ? clFetchFn(urlFromDoc, { c:'fill', w:60, h:60, q:'auto', f:'auto', radius:'max' })
        : urlFromDoc;
    }
  } else {
    // inline SVG placeholder (dosyaya gerek yok)
    sAv = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2VlZWVlZSIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjIiIHI9IjExIiBmaWxsPSIjY2NjY2NjIi8+PHBhdGggZD0iTTMyIDM2Yy0xNiAwLTIyIDguNy0yMiAxMy4zIDAgMS44IDEuNSAzLjMgMy4zIDMuM2gzNy40YzEuOCAwIDMuMy0xLjUgMy4zLTMuMyAwLTQuNi02LTEzLjMtMjItMTMuM3oiIGZpbGw9IiNjY2NjY2MiLz48L3N2Zz4=';
  }
} catch {
  sAv = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2VlZWVlZSIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjIiIHI9IjExIiBmaWxsPSIjY2NjY2NjIi8+PHBhdGggZD0iTTMyIDM2Yy0xNiAwLTIyIDguNy0yMiAxMy4zIDAgMS44IDEuNSAzLjMgMy4zIDMuM2gzNy40YzEuOCAwIDMuMy0xLjUgMy4zLTMuMyAwLTQuNi02LTEzLjMtMjItMTMuM3oiIGZpbGw9IiNjY2NjY2MiLz48L3N2Zz4=';
}

// <img src="${sAv}">

  // ——— Konum (varsa ilan içinden) ———
  const city = it.province || it.city || it.sehir || '';
  const dist = it.district || it.ilce  || '';
  const loc  = city ? (dist ? `${city} / ${dist}` : city) : '';

  // ——— Doğrulanmış satıcı bayrağı (ilan içi çeşitli alan adları) ———
  const verified = !!(it.sellerVerified || it.verifiedSeller || it.verified || it.isVerified);

  // ——— Fiyat ———
  const price = (typeof it.price === 'number')
    ? formatPrice(it.price)
    : '';

  // ——— Kapak görseli ———
  const coverSrc = imgSrc || (Array.isArray(it.photos) ? clMain(it.photos[0]) : '') || '';

  // ——— İçerik ———
  body.innerHTML = `
    <div style="display:grid;gap:12px">
      <div style="border-radius:14px;overflow:hidden;border:1px solid #eee">
        <img src="${coverSrc}" alt="${it.title || ''}" style="width:100%;height:auto;display:block" width="1200" height="825">
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="av" style="width:34px;height:34px">
          <img src="${sAv}" alt="${sName}" width="34" height="34" style="border-radius:50%">
        </div>
        <div style="font-weight:700">
          ${sName}${loc ? ` · <span style="color:#6b7280">${loc}</span>` : ''}
        </div>
        ${verified ? `<span class="badge">${(I18N?.[UE?.getLang?.() || 'tr']?.['seller.verified'] || I18N?.tr?.['seller.verified'] || 'Onaylı')}</span>` : ''}
      </div>

      <div>
        <div style="font-size:20px;font-weight:900">${it.title || ''}</div>
        <div style="color:#6b7280;margin-top:6px">${it.description || ''}</div>
      </div>

      <div style="font-size:18px;font-weight:900">${price}</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn gold"  id="detailOrder">${(I18N?.[UE?.getLang?.() || 'tr']?.['buttons.order']   || I18N?.tr?.['buttons.order']   || 'Sipariş Ver')}</button>
        <button class="btn ghost" id="detailMsg">${(I18N?.[UE?.getLang?.() || 'tr']?.['buttons.message'] || I18N?.tr?.['buttons.message'] || 'Satıcıya Yaz')}</button>
      </div>
    </div>`;

  document.getElementById('detailOrder')?.addEventListener('click', () => window.openAuth?.());
  document.getElementById('detailMsg')  ?.addEventListener('click', () => window.openAuth?.());

  if (typeof modal.showModal === 'function') modal.showModal();
  else { modal.setAttribute('open',''); modal.style.display='grid'; }
}

    document.querySelector('[data-close-listing]')?.addEventListener('click',()=>{
  const modal = document.getElementById('listingModal');
  if (typeof modal.close === 'function') modal.close();
});

    prevBtn.addEventListener('click',()=>{ if(page>0){ page--; render(); }});
    nextBtn.addEventListener('click',()=>{ if((page+1)*PAGE_SIZE < allListings.length){ page++; render(); }});

    async function loadListings() {
  try {
    // Güvenli I18N kontrolü
    const dict = I18N?.[currentLang] || I18N?.tr || {};
    info.textContent = dict['list.loading'] || 'Yükleniyor…';

    const colRef = collection(db2, 'listings');
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);

    const now = Date.now();
    const rows = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data?.status === 'approved') {
        const exp = data?.expiresAt?.toDate
          ? data.expiresAt.toDate().getTime()
          : (data?.expiresAt ? new Date(data.expiresAt).getTime() : now + 1);
        if (exp >= now) {
          rows.push({ id: docSnap.id, ...data });
        }
      }
    });

    const showcase = rows.filter(r => !!r.showcase);
    const standard = rows.filter(r => !r.showcase);
    allListings = [...showcase, ...standard];
    page = 0;
    render();
  } catch (err) {
    info.textContent = currentLang === 'en'
      ? 'Failed to load listings'
      : 'İlanlar yüklenemedi';
    console.error(err);
  }
}

// Firebase hazır olduğunda çalıştır
if (self.__fbReady) {
  loadListings();
} else {
  document.addEventListener('fb-ready', loadListings, { once: true });
}

    // dil değişirse liste metinlerini yenile
    window.addEventListener('storage', (e)=>{ if(e.key==='ue_lang'){ currentLang = localStorage.getItem('ue_lang')||'tr'; render(); } });
  
