// admin-messages.js — ÜE Admin "Mesajlar" modülü (canlı destek)
// Kullanım:
// <script type="module">
//   import { mountAdminMessages } from "/admin/admin-messages.js";
//   mountAdminMessages({ container: document.getElementById('messages') });
// </script>

const FIREBASE_CANDIDATES = [
  '/firebase-init.js',
  './firebase-init.js',
  '../firebase-init.js',
  '/docs/firebase-init.js',
];

async function getFirebase(){
  for (const p of FIREBASE_CANDIDATES){
    try{
      const mod = await import(p + `?v=${Date.now()}`);
      if (mod?.db) return { db: mod.db, auth: mod.auth };
    }catch(_){/* sıradaki yolu dene */}
  }
  throw new Error('firebase-init.js bulunamadı ya da db dışa aktarılmadı');
}

let FF = null; // firestore helpers
async function getFF(){
  if (FF) return FF;
  FF = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  return FF;
}

function htmlesc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m])); }

function skeleton(){
  return `
  <div style="display:grid;grid-template-columns:320px 1fr;gap:12px">
    <div class="card" style="padding:12px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input id="am-q" type="text" placeholder="Kullanıcı / e‑posta ara" style="flex:1;background:transparent;border:1px solid #1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;outline:none"/>
        <button id="am-reload" class="btn-sm" style="appearance:none;border:none;background:#22d3ee;color:#001018;padding:8px 12px;border-radius:10px;cursor:pointer;font-weight:600">Yenile</button>
      </div>
      <div id="am-convs" style="display:grid;gap:8px;max-height:65vh;overflow:auto"></div>
    </div>

    <div class="card" style="padding:0;display:flex;flex-direction:column;min-height:420px">
      <div id="am-thread-head" style="padding:12px;border-bottom:1px solid #1f2937;display:flex;gap:8px;align-items:center">
        <strong id="am-user">Seçim yapın</strong>
        <span id="am-when" style="color:#9ca3af;margin-left:auto"></span>
      </div>
      <div id="am-thread" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px"></div>
      <form id="am-send" style="display:flex;gap:8px;padding:12px;border-top:1px solid #1f2937">
        <input id="am-input" type="text" placeholder="Mesaj yazın…" autocomplete="off" style="flex:1;background:transparent;border:1px solid #1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;outline:none"/>
        <button class="btn" type="submit" style="background:#22d3ee;color:#001018">Gönder</button>
      </form>
    </div>
  </div>`;
}

export async function mountAdminMessages({ container, onReady }={}){
  if (!container) throw new Error('mountAdminMessages: container eksik');
  container.classList.add('card');
  container.innerHTML = skeleton();

  const convList  = container.querySelector('#am-convs');
  const qInput    = container.querySelector('#am-q');
  const reloadBtn = container.querySelector('#am-reload');
  const threadBox = container.querySelector('#am-thread');
  const threadHead= container.querySelector('#am-thread-head');
  const userNameEl= container.querySelector('#am-user');
  const whenEl    = container.querySelector('#am-when');
  const formSend  = container.querySelector('#am-send');
  const inputSend = container.querySelector('#am-input');

  let activeId = null;
  let unsubConv = null; // conversations listener
  let unsubThread = null; // messages listener

  let fb, db, auth; let conversationsCache = [];
  try{ fb = await getFirebase(); db = fb.db; auth = fb.auth; }
  catch(e){
    convList.innerHTML = `<div style="color:#ef4444">Firebase hazır değil: ${htmlesc(e.message)}</div>`;
    if (onReady) onReady(false);
    return;
  }

  const { collection, doc, getDocs, setDoc, addDoc, deleteDoc, query, orderBy, limit, where, serverTimestamp, onSnapshot } = await getFF();

  function convCardHTML(id, c){
    const name = c.userName || c.userId || id;
    const last = c.lastMessage || '';
    const when = c.updatedAt?.toDate ? c.updatedAt.toDate() : (c.updatedAt?.seconds ? new Date(c.updatedAt.seconds*1000) : null);
    const hh = when ? when.toLocaleString() : '';
    return `
      <button class="conv" data-id="${id}" style="text-align:left;background:transparent;border:1px solid #1f2937;color:#e5e7eb;padding:10px;border-radius:10px;cursor:pointer">
        <div style="display:flex;gap:6px;align-items:center">
          <strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${htmlesc(name)}</strong>
          <span style="color:#9ca3af;font-size:12px">${hh}</span>
        </div>
        <div style="color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${htmlesc(last)}</div>
      </button>`;
  }

  function renderConvs(list){
    if (!list.length){
      convList.innerHTML = '<div style="color:#9ca3af">Konuşma yok</div>';
      return;
    }
    convList.innerHTML = list.map(d=>convCardHTML(d.id, d.data)).join('');
    // aktif olanı vurgula
    if (activeId){
      const b = convList.querySelector(`.conv[data-id="${CSS.escape(activeId)}"]`);
      if (b) b.style.borderColor = '#22d3ee';
    }
  }

  function renderThread(list){
    if (!list.length){
      threadBox.innerHTML = '<div style="color:#9ca3af">Mesaj yok</div>';
      return;
    }
    threadBox.innerHTML = '';
    for (const m of list){
      const mine = m.byAdmin || (auth?.currentUser && (m.from===auth.currentUser.uid));
      const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : '';
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.justifyContent = mine ? 'flex-end' : 'flex-start';
      wrap.innerHTML = `
        <div style="max-width:70%;padding:8px 10px;border-radius:12px;border:1px solid #1f2937;${mine? 'background:#0b1220':'background:#0e172a'}">
          <div style="white-space:pre-wrap">${htmlesc(m.text || '')}</div>
          <div style="color:#9ca3af;font-size:11px;margin-top:4px;text-align:${mine?'right':'left'}">${time}</div>
        </div>`;
      threadBox.appendChild(wrap);
    }
    threadBox.scrollTop = threadBox.scrollHeight;
  }

  function attachThread(convId, meta){
    // başlık
    userNameEl.textContent = meta.userName || meta.userId || convId;
    const when = meta.updatedAt?.toDate ? meta.updatedAt.toDate().toLocaleString() : '';
    whenEl.textContent = when;

    // önceki dinleyiciyi kapat
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
      conversationsCache = snap.docs.map(d=>({ id:d.id, data:d.data() }));
      const q = (qInput?.value || '').trim().toLowerCase();
      const filtered = q
        ? conversationsCache.filter(x =>
            (x.data.userName||x.id||'').toLowerCase().includes(q) ||
            (x.data.userEmail||'').toLowerCase().includes(q)
          )
        : conversationsCache;
      renderConvs(filtered);
    });
  }

  reloadBtn?.addEventListener('click', listenConversations);
  qInput?.addEventListener('input', ()=>{
    const q = (qInput?.value || '').trim().toLowerCase();
    const filtered = q
      ? conversationsCache.filter(x =>
          (x.data.userName||x.id||'').toLowerCase().includes(q) ||
          (x.data.userEmail||'').toLowerCase().includes(q)
        )
      : conversationsCache;
    renderConvs(filtered);
  });

  convList.addEventListener('click', (e)=>{
    const b = e.target.closest('.conv'); if (!b) return;
    activeId = b.getAttribute('data-id');
    const obj = conversationsCache.find(x=>x.id===activeId);
    if (obj) attachThread(activeId, obj.data);
    renderConvs(conversationsCache); // aktif vurgusu
  });

  formSend.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text = (inputSend.value || '').trim();
    if (!text || !activeId) return;
    try{
      // auth yoksa anonim açmayı dener (firebase-init böyle ayarlıysa)
      if (auth && !auth.currentUser && auth.signInAnonymously){
        try { await auth.signInAnonymously(auth); } catch {}
      }
      const adminId = auth?.currentUser?.uid || 'admin';
      const convRef = doc(db, 'conversations', activeId);
      await addDoc(collection(convRef, 'messages'), {
        text,
        from: adminId,
        byAdmin: true,
        createdAt: serverTimestamp(),
      });
      await setDoc(convRef, {
        lastMessage: text,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      inputSend.value='';
    }catch(err){
      console.error(err);
      alert('Gönderilemedi: ' + err.message);
    }
  });

  // başlat
  listenConversations();
  if (onReady) onReady(true);
}

export default { mountAdminMessages };
