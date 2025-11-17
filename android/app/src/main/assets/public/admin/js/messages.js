// /admin/js/messages.js — ÜE Admin: Mesajlar (canlı destek)
// export: mountAdminMessages({ container })

/* ==============================================
   Firebase bağlayıcı — sadece firebase-init.js kullan
   (çoklu instance/versiyon çakışmasını engellemek için)
   ============================================== */

const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js'
];

let FF = null;
async function getFF() {
  if (FF) return FF;
  const mod = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js');
  const app = window.__fb?.app || undefined;
  const db = window.__fb?.db || mod.getFirestore(app);
  return { ...mod, db };
}

async function ensureFirebaseReady() {
  if (window.__fb?.auth && window.__fb?.db) {
    return {
      auth: window.__fb.auth,
      db: window.__fb.db,
      onAuthStateChanged:
        window.__fb.onAuthStateChanged ||
        (typeof window.onAuthStateChanged === 'function' ? window.onAuthStateChanged : null),
    };
  }
  for (const p of FIREBASE_CANDIDATES) {
    try {
      const mod = await import(p + `?v=${Date.now()}`);
      const auth = mod?.auth || window.__fb?.auth;
      const db   = mod?.db   || window.__fb?.db;
      const onAuthStateChanged =
        mod?.onAuthStateChanged ||
        window.__fb?.onAuthStateChanged ||
        (typeof window.onAuthStateChanged === 'function' ? window.onAuthStateChanged : null);
      if (auth && db) return { auth, db, onAuthStateChanged };
    } catch(_) {}
  }
  throw new Error('firebase-init.js bulunamadı veya auth/db export etmiyor.');
}

/* ========== yardımcılar ========== */
function htmlesc(s){
  return String(s ?? '').replace(/[&<>\"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

const ADMIN_ALLOW_UIDS = ['t4R6bdEQ3QdEGDskPxe9XAun9kI3'];

async function ensureAdminAuth() {
  const { auth, db, onAuthStateChanged } = await ensureFirebaseReady();
  if (!auth.currentUser && typeof onAuthStateChanged === 'function') {
    await new Promise((resolve) => {
      const stop = onAuthStateChanged(auth, (u) => { if (u) { stop?.(); resolve(); } });
    });
  }
  if (!auth.currentUser) throw new Error('admin-login-required');
  if (auth.currentUser.isAnonymous) throw new Error('admin-login-required');
  if (ADMIN_ALLOW_UIDS.includes(auth.currentUser.uid)) return { auth, db };

  const { getDoc, doc } = await getFF();
  let isAdmin = false;
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const snap = await getDoc(userRef);
    const d = snap.exists() ? snap.data() : null;
    isAdmin = (d?.role === 'admin') || (d?.status === 'admin');
  } catch(_) {}

  if (!isAdmin) {
    try {
      const t = await auth.currentUser.getIdTokenResult(true);
      const email = (auth.currentUser.email||'').toLowerCase();
      const claimAdmin  = t?.claims?.admin === true;
      const domainAdmin = email.endsWith('@ureteneller.com');
      isAdmin = claimAdmin || domainAdmin;
    } catch(_) {}
  }
  if (!isAdmin) throw new Error('not-admin');
  return { auth, db };
}

/* ========== ana modül ========== */
export async function mountAdminMessages({ container }) {
  if (!container) throw new Error('mountAdminMessages: container yok');

  container.innerHTML = `
    <div class="row" style="align-items:center">
      <h2 style="margin-right:auto">Mesajlar & Canlı Destek</h2>
      <input id="qMsg" class="input" placeholder="Kullanıcı adı / e-posta / ID"/>
      <button id="btnReloadMsg" class="btn-sm">Yenile</button>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:12px;min-height:400px">
      <div style="border:1px solid #1f2937;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">
        <div style="padding:.55rem .6rem;border-bottom:1px solid #1f2937;font-weight:800;display:flex;justify-content:space-between;align-items:center">
          <span>Konuşmalar</span>
          <button id="btnDelConv" class="btn-sm" title="Seçili sohbeti sil">🗑️</button>
        </div>
        <div id="convList" style="flex:1;overflow:auto"></div>
      </div>

      <div style="border:1px solid #1f2937;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">
        <div style="padding:.55rem .6rem;border-bottom:1px solid #1f2937;display:flex;gap:.5rem;align-items:center">
          <button id="threadUser" class="btn-sm" style="background:none;border:none;color:#e5e7eb;font-weight:700;cursor:pointer">Seçili değil</button>
          <span id="threadWhen" class="muted" style="margin-left:auto"></span>
        </div>
        <div id="threadBox" style="flex:1;overflow:auto;padding:.6rem;display:grid;gap:.4rem;background:#0a0f1c"></div>
        <form id="formSend" style="display:flex;gap:.5rem;padding:.6rem;border-top:1px solid #1f2937">
          <input id="inputSend" class="input" placeholder="Yanıt yazın..." style="flex:1" autocomplete="off"/>
          <button class="btn-sm" type="submit">Gönder</button>
        </form>
      </div>
    </div>
  `;

  // 🔹 Auth kontrolü
  let auth, db;
  try {
    const ctx = await ensureAdminAuth();
    auth = ctx.auth; db = ctx.db;
  } catch {
    container.innerHTML = `<div class="muted">Bu bölümü görmek için admin yetkisi gerekiyor.</div>`;
    return;
  }

  const FF = await getFF();
  const { collection, doc, query, orderBy, limit, onSnapshot, addDoc, setDoc, deleteDoc, serverTimestamp, getFirestore } = FF;
  if (!db) {
    const app = window.__fb?.app || undefined;
    db = window.__fb?.db || getFirestore(app);
  }

  // DOM
  const convList   = container.querySelector('#convList');
  const threadBox  = container.querySelector('#threadBox');
  const formSend   = container.querySelector('#formSend');
  const inputSend  = container.querySelector('#inputSend');
  const qInput     = container.querySelector('#qMsg');
  const reloadBtn  = container.querySelector('#btnReloadMsg');
  const delBtn     = container.querySelector('#btnDelConv');
  const userNameEl = container.querySelector('#threadUser');
  const whenEl     = container.querySelector('#threadWhen');

  let activeId = null, unsubConv = null, unsubThread = null, lastConvSnapshot = [];

  // 🔊 ses dosyası (her yeni mesajda)
  const snd = new Audio('/notify.wav');

  /* ---------- render yardımcıları ---------- */
  function renderConvs(list){
    convList.innerHTML = '';
    if (!list.length) {
      convList.innerHTML = `<div class="muted" style="padding:.6rem">Kayıt yok</div>`;
      return;
    }
    for (const x of list){
      const id   = x.id;
      const d = x.data;
      const name = d.userName || d.userEmail || id;
      const avatar = d.userAvatar || '/assets/img/avatar-default.png';
      const last = d.lastMessage || '';
      const when = d.updatedAt?.toDate ? d.updatedAt.toDate().toLocaleString() : '';
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'conv';
      div.dataset.id = id;
      div.style.cssText = 'display:flex;gap:.5rem;align-items:center;width:100%;border:0;border-bottom:1px solid #111;background:#000;color:#e5e7eb;padding:.55rem .6rem;cursor:pointer;text-align:left';
      div.innerHTML = `
        <img src="${avatar}" width="38" height="38" style="border-radius:50%;object-fit:cover;border:1px solid #1f2937"/>
        <div style="flex:1;min-width:0">
          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${htmlesc(name)}</strong>
          <div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${htmlesc(last)}</div>
          <div class="muted" style="font-size:11px">${htmlesc(when)}</div>
        </div>
      `;
      convList.appendChild(div);
    }
  }

  function renderThread(list){
    threadBox.innerHTML = '';
    for (const m of list){
      const mine = m.byAdmin || (auth?.currentUser && (m.from === auth.currentUser.uid));
      const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : '';
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.justifyContent = mine ? 'flex-end' : 'flex-start';
      wrap.innerHTML = `
        <div style="max-width:70%;padding:8px 10px;border-radius:12px;border:1px solid #1f2937;${mine? 'background:#0b1220':'background:#0e172a'}">
          <div style="white-space:pre-wrap">${htmlesc(m.text || '')}</div>
          <div style="color:#9ca3af;font-size:11px;margin-top:4px;text-align:${mine?'right':'left'}">${htmlesc(time)}</div>
        </div>`;
      threadBox.appendChild(wrap);
    }
    threadBox.scrollTop = threadBox.scrollHeight;
    if (list.length) snd.play().catch(()=>{});
  }

  function attachThread(convId, meta){
    userNameEl.textContent = meta.userName || meta.userEmail || convId;
    const when = meta.updatedAt?.toDate ? meta.updatedAt.toDate().toLocaleString() : '';
    whenEl.textContent = when;
    if (unsubThread) try{ unsubThread(); }catch{}
    const convRef = doc(db, 'conversations', convId);
    const qMsg = query(collection(convRef, 'messages'), orderBy('createdAt','asc'), limit(500));
    unsubThread = onSnapshot(qMsg, snap => {
      const arr = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderThread(arr);
    });
  }

  function listenConversations(){
    if (unsubConv) try{ unsubConv(); }catch{}
    const qConv = query(collection(db,'conversations'), orderBy('updatedAt','desc'), limit(100));
    unsubConv = onSnapshot(qConv, snap => {
      const raw = snap.docs.map(d=>({ id:d.id, data:d.data() }));
      lastConvSnapshot = raw;
      const q = (qInput?.value || '').trim().toLowerCase();
      const filtered = q
        ? raw.filter(x =>
            (x.data.userName||x.id||'').toLowerCase().includes(q) ||
            (x.data.userEmail||'').toLowerCase().includes(q)
          )
        : raw;
      renderConvs(filtered);
      if (!activeId && filtered.length){
        activeId = filtered[0].id;
        attachThread(activeId, filtered[0].data);
      }
    });
  }

  reloadBtn?.addEventListener('click', listenConversations);
  qInput?.addEventListener('input', ()=>{
    const q = (qInput?.value || '').trim().toLowerCase();
    const filtered = q
      ? lastConvSnapshot.filter(x =>
          (x.data.userName||x.id||'').toLowerCase().includes(q) ||
          (x.data.userEmail||'').toLowerCase().includes(q)
        )
      : lastConvSnapshot;
    renderConvs(filtered);
  });

  convList.addEventListener('click', (e)=>{
    const b = e.target.closest('.conv'); if (!b) return;
    activeId = b.dataset.id;
    const found = lastConvSnapshot.find(x => x.id === activeId);
    attachThread(activeId, found ? found.data : { userName: activeId });
  });

  // Kullanıcı adına tıklayınca profil sayfasına git (admin olarak)
  userNameEl.addEventListener('click', ()=>{
    if (!activeId) return;
    window.location.href = `/admin/panel.html#users?id=${activeId}`;
  });

  // Sohbet silme
  delBtn.addEventListener('click', async ()=>{
    if (!activeId) return alert('Lütfen önce bir sohbet seçin.');
    if (!confirm('Bu sohbeti silmek istediğinizden emin misiniz?')) return;
    try {
      const convRef = doc(db, 'conversations', activeId);
      await deleteDoc(convRef);
      threadBox.innerHTML = '';
      activeId = null;
      listenConversations();
    } catch(err){
      console.error(err);
      alert('Silinemedi: '+err.message);
    }
  });

  formSend.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text = (inputSend.value || '').trim(); if (!text || !activeId) return;
    try{
      const adminId = auth?.currentUser?.uid || 'admin';
      const convRef = doc(db, 'conversations', activeId);
      await addDoc(collection(convRef, 'messages'), {
  text,
  from: adminId,
  byAdmin: true,
  to: activeId, // 🔹 EKLENDİ — mesajın kime gittiğini belirt
  createdAt: serverTimestamp()
});
      await setDoc(convRef, { lastMessage: text, updatedAt: serverTimestamp() }, { merge: true });
      inputSend.value='';
    }catch(err){
      console.error(err);
      alert('Gönderilemedi: ' + (err?.message || err));
    }
  });

  listenConversations();

  window.addEventListener('beforeunload', ()=>{
    if (unsubConv) try{ unsubConv(); }catch{}
    if (unsubThread) try{ unsubThread(); }catch{}
  });
}

export default { mountAdminMessages };
