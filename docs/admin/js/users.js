// users.js — ÜE Admin: Kullanıcılar modülü
// mountAdminUsers({ container })


const FIREBASE_CANDIDATES = [
'/firebase-init.js', './firebase-init.js', '../firebase-init.js', '/docs/firebase-init.js'
];


async function getFirebase(){
for (const p of FIREBASE_CANDIDATES){
try {
const mod = await import(p + `?v=${Date.now()}`);
if (mod?.db) return { db: mod.db, auth: mod.auth };
} catch(_){}
}
throw new Error('firebase-init.js bulunamadı veya db export etmiyor');
}


let FF = null; // Firestore helpers (tek sefer yükle)
async function getFF(){
if (FF) return FF;
FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
return FF;
}


function htmlesc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }


export async function mountAdminUsers({ container }){
if (!container) throw new Error('mountAdminUsers: container yok');
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
<tbody id="usersBody"><tr><td colspan="6" class="muted">Yükleniyor…</td></tr></tbody>
</table>
</div>
`;


let fb, db, auth;
try { fb = await getFirebase(); db = fb.db; auth = fb.auth; }
catch(e){
const tbody = container.querySelector('#usersBody');
tbody.innerHTML = `<tr><td colspan="6" class="muted">Firebase hazır değil: ${htmlesc(e.message)}</td></tr>`;
return;
}


const { collection, doc, getDocs, setDoc, query, orderBy, limit, serverTimestamp } = await getFF();


const usersBody = container.querySelector('#usersBody');
const btnReload = container.querySelector('#btnReloadUsers');
const qInput = container.querySelector('#qUser');
let usersCache = [];


const msToDays = (ms)=> Math.max(0, Math.floor(ms/86400000));
const isPro = (u)=>{ const ts = u.proUntil ?? u.premiumUntil; const t = typeof ts==='number'? ts : (ts?.seconds? ts.seconds*1000:0); return t > Date.now(); };
const proLeftText = (u)=>{ const ts = u.proUntil ?? u.premiumUntil; const t = typeof ts==='number'? ts : (ts?.seconds? ts.seconds*1000:0); if(!t||t<=Date.now()) return '—'; const d=msToDays(t-Date.now()); return d>0? `AKTİF (${d}g)` : 'AKTİF (bugün)'; };


async function loadUsers(){
try {
const qRef = query(collection(db,'users'), orderBy('email'), limit(500));
export default { mountAdminUsers };
