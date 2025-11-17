/* /public/assets/js/i18n.js */
/* Tek dosya i18n: TR/EN/AR/DE — tüm sayfalarda kullanılabilir.
   Kullanım (HTML): <script src="/assets/js/i18n.js"></script>
   Kullanım (ESM): import { I18N } from "/assets/js/i18n.js";
*/

(function (global) {
  const SUPPORTED = ["tr", "en", "ar", "de"];
  const LOCALE_LABEL = { tr: "Türkçe", en: "English", ar: "العربية", de: "Deutsch" };

  // --- Dil tespiti & ayarlama ---
  function detectLang() {
    try {
      const saved = localStorage.getItem("lang");
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch {}
    const nav = (navigator.language || "tr").slice(0, 2).toLowerCase();
    return SUPPORTED.includes(nav) ? nav : "tr";
  }

  function setLang(lang) {
    const L = SUPPORTED.includes(lang) ? lang : "tr";
    try { localStorage.setItem("lang", L); } catch {}
    document.documentElement.lang = L;
    document.documentElement.dir = L === "ar" ? "rtl" : "ltr";
    return L;
  }

  function getLang() {
    const l = detectLang();
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    return l;
  }

  // --- Metinler ---
  const STR = {
    tr: {
      brand: "Üreten Eller",
      heroTitle: "Üreten Ellere Hoş Geldiniz",
      sellerPortal: "Üreten El Portalı",
      customerPortal: "Müşteri Portalı",
      loginToView: "İlanı görmek için giriş yapın veya kaydolun.",
      // Footer / Legal bar
      legalBarTitle: "Kurumsal",
      legal: {
        home: "Ana Sayfa",
        open: "Aç",
        close: "Kapat",
        copyright: "© 2025 Üreten Eller",
        // Link başlıkları
        corporate: "Kurumsal",
        about: "Hakkımızda",
        contact: "İletişim",
        privacy: "Gizlilik",
        kvkk: "KVKK Aydınlatma",
        terms: "Kullanım Şartları",
        cookies: "Çerez Politikası",
        distance: "Mesafeli Satış",
        shippingReturn: "Teslimat & İade",
        community: "Topluluk Kuralları",
      },
      // Legal sayfa başlıkları (slug -> başlık)
      legalTitles: {
        "kullanim-sartlari": "Kullanım Şartları",
        "gizlilik": "Gizlilik Politikası",
        "kvkk-aydinlatma": "KVKK Aydınlatma Metni",
        "cerez-politikasi": "Çerez Politikası",
        "mesafeli-satis-sozlesmesi": "Mesafeli Satış Sözleşmesi",
        "teslimat-iade": "Teslimat ve İade Şartları",
        "topluluk-kurallari": "Topluluk Kuralları",
        "hakkimizda": "Hakkımızda",
        "iletisim": "İletişim"
      }
    },
    en: {
      brand: "Ureten Eller",
      heroTitle: "Welcome to Ureten Eller",
      sellerPortal: "Maker Portal",
      customerPortal: "Customer Portal",
      loginToView: "Please sign in or sign up to view the listing.",
      legalBarTitle: "Corporate",
      legal: {
        home: "Home",
        open: "Open",
        close: "Close",
        copyright: "© 2025 Ureten Eller",
        corporate: "Corporate",
        about: "About Us",
        contact: "Contact",
        privacy: "Privacy",
        kvkk: "KVKK Notice",
        terms: "Terms of Use",
        cookies: "Cookie Policy",
        distance: "Distance Sales",
        shippingReturn: "Shipping & Returns",
        community: "Community Guidelines",
      },
      legalTitles: {
        "kullanim-sartlari": "Terms of Use",
        "gizlilik": "Privacy Policy",
        "kvkk-aydinlatma": "KVKK Notice",
        "cerez-politikasi": "Cookie Policy",
        "mesafeli-satis-sozlesmesi": "Distance Sales Agreement",
        "teslimat-iade": "Shipping & Returns",
        "topluluk-kurallari": "Community Guidelines",
        "hakkimizda": "About Us",
        "iletisim": "Contact"
      }
    },
    ar: {
      brand: "أُنتِج بالأيادي",
      heroTitle: "مرحبًا بكم في منصتنا",
      sellerPortal: "بوابة المُنتِجات",
      customerPortal: "بوابة العملاء",
      loginToView: "سجّل الدخول أو أنشئ حسابًا لعرض الإعلان.",
      legalBarTitle: "المعلومات المؤسسية",
      legal: {
        home: "الصفحة الرئيسية",
        open: "فتح",
        close: "إغلاق",
        copyright: "© 2025 Üreten Eller",
        corporate: "المؤسسة",
        about: "من نحن",
        contact: "اتصال",
        privacy: "الخصوصية",
        kvkk: "إشعار KVKK",
        terms: "شروط الاستخدام",
        cookies: "سياسة ملفات تعريف الارتباط",
        distance: "البيع عن بُعد",
        shippingReturn: "الشحن والإرجاع",
        community: "قواعد المجتمع",
      },
      legalTitles: {
        "kullanim-sartlari": "شروط الاستخدام",
        "gizlilik": "سياسة الخصوصية",
        "kvkk-aydinlatma": "إشعار KVKK",
        "cerez-politikasi": "سياسة ملفات الارتباط",
        "mesafeli-satis-sozlesmesi": "اتفاقية البيع عن بُعد",
        "teslimat-iade": "الشحن والإرجاع",
        "topluluk-kurallari": "قواعد المجتمع",
        "hakkimizda": "من نحن",
        "iletisim": "اتصال"
      }
    },
    de: {
      brand: "Ureten Eller",
      heroTitle: "Willkommen bei Ureten Eller",
      sellerPortal: "Portal für Anbieterinnen",
      customerPortal: "Kundenportal",
      loginToView: "Bitte anmelden oder registrieren, um das Inserat zu sehen.",
      legalBarTitle: "Unternehmen",
      legal: {
        home: "Startseite",
        open: "Öffnen",
        close: "Schließen",
        copyright: "© 2025 Ureten Eller",
        corporate: "Unternehmen",
        about: "Über uns",
        contact: "Kontakt",
        privacy: "Datenschutz",
        kvkk: "KVKK-Hinweis",
        terms: "Nutzungsbedingungen",
        cookies: "Cookie-Richtlinie",
        distance: "Fernabsatz",
        shippingReturn: "Lieferung & Rückgabe",
        community: "Community-Regeln",
      },
      legalTitles: {
        "kullanim-sartlari": "Nutzungsbedingungen",
        "gizlilik": "Datenschutz",
        "kvkk-aydinlatma": "KVKK-Hinweis",
        "cerez-politikasi": "Cookie-Richtlinie",
        "mesafeli-satis-sozlesmesi": "Fernabsatzvertrag",
        "teslimat-iade": "Lieferung & Rückgabe",
        "topluluk-kurallari": "Community-Regeln",
        "hakkimizda": "Über uns",
        "iletisim": "Kontakt"
      }
    }
  };

  // Basit yardımcılar
  function strings(lang) {
    const L = SUPPORTED.includes(lang) ? lang : "tr";
    return STR[L];
  }

  function titleForSlug(lang, slug) {
    const L = strings(lang);
    return L.legalTitles[slug] || slug;
  }

  // Global API
  const I18N = {
    SUPPORTED,
    LOCALE_LABEL,
    STR,
    detectLang,
    getLang,
    setLang,
    strings,
    titleForSlug
  };

  // Global pencereye ve ESM export’una koy
  global.I18N = I18N;
  if (typeof exportMaps !== "undefined") exportMaps.I18N = I18N; // güvenli no-op
  if (typeof window !== "undefined") window.I18N = I18N;

  // ESM desteği
  if (typeof define === "function" && define.amd) {
    define([], () => I18N);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { I18N };
  } else {
    global.I18N = I18N;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
