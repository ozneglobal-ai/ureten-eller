// /admin/js/admin-panel.js  (docs/admin/js/... kopyası da aynı olmalı)
const sections = Array.from(document.querySelectorAll('.section'));
const links    = Array.from(document.querySelectorAll('.menu a'));
const emptyHint = document.getElementById('emptyHint');

function show(sectionId){
  // Bölümleri gizle
  sections.forEach(s => s.classList.remove('active'));
  // Menü aktifliği
  links.forEach(a => a.classList.remove('active'));

  // Hedefi aç
  const target = document.querySelector(`.section#${CSS.escape(sectionId)}`);
  const link   = links.find(a => (a.dataset.target === sectionId) || (a.getAttribute('href') === `#${sectionId}`));

  if (target){
    target.classList.add('active');
    if (emptyHint) emptyHint.style.display = 'none';
  } else {
    // Hedef yoksa ipucu göster
    if (emptyHint) emptyHint.style.display = '';
  }

  if (link) link.classList.add('active');
  // URL hash senkronu
  if (location.hash !== `#${sectionId}`) history.replaceState(null, '', `#${sectionId}`);
}

// Menü tıklamaları
links.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const id = a.dataset.target || a.getAttribute('href').replace('#','');
    if (id) show(id);
  });
});

// Hash ile doğrudan gelme
window.addEventListener('hashchange', () => {
  const id = (location.hash || '').replace('#','');
  if (id) show(id);
});

// İlk yükleme: hash varsa onu göster, yoksa hepsi gizli kalsın
document.addEventListener('DOMContentLoaded', () => {
  const first = (location.hash || '').replace('#','');
  if (first) show(first);
});
