// Basit sekme yöneticisi: ilk açılışta hiçbir section görünmez.
// Sadece menüden tıklanan bölüm açılır.

const sections  = Array.from(document.querySelectorAll('.section'));
const links     = Array.from(document.querySelectorAll('.menu a'));
const emptyHint = document.getElementById('emptyHint');

// Hepsini gizle
function hideAll(){
  sections.forEach(s => s.classList.remove('active'));
  links.forEach(a => a.classList.remove('active'));
  if (emptyHint) emptyHint.style.display = '';
}

// Sadece hedefi göster
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

// Menü tıklamaları
links.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const id = a.dataset.target || (a.getAttribute('href') || '').replace('#','');
    if (id) show(id);
  });
});

// İlk yükleme: hash olsa bile açma (tamamen boş kalsın)
// Eğer hash ile otomatik açılsın istersen alttaki iki satırın yorumunu kaldır.
// const initial = (location.hash || '').replace('#','');
// if (initial) show(initial);

// Başlangıç boş
hideAll();
