// messages.js — ÜE Admin: Mesajlar (canlı destek)
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
userNameEl.textContent = meta.userName || meta.userId || convId;
const when = meta.updatedAt?.toDate ? meta.updatedAt.toDate().toLocaleString() : '';
whenEl.textContent = when;
if (unsubThread) try{ unsubThread(); }catch{}
const convRef = doc(db, 'conversations', convId);
const qMsg = query(collection(convRef, 'messages'), orderBy('createdAt','asc'), limit(500));
unsubThread = onSnapshot(qMsg, snap => { const arr = snap.docs.map(d=>({ id:d.id, ...d.data() })); renderThread(arr); });
}


function listenConversations(){
if (unsubConv) try{ unsubConv(); }catch{}
const qConv = query(collection(db,'conversations'), orderBy('updatedAt','desc'), limit(100));
unsubConv = onSnapshot(qConv, snap => {
const list = snap.docs.map(d=>({ id:d.id, data:d.data() }));
const q = (qInput?.value || '').trim().toLowerCase();
const filtered = q ? list.filter(x => (x.data.userName||x.id||'').toLowerCase().includes(q) || (x.data.userEmail||'').toLowerCase().includes(q)) : list;
renderConvs(filtered);
});
}


reloadBtn?.addEventListener('click', listenConversations);
qInput?.addEventListener('input', ()=>{
// anlık filtre (cache onSnapshot içinde)
listenConversations();
});


convList.addEventListener('click', (e)=>{
const b = e.target.closest('.conv'); if (!b) return;
activeId = b.getAttribute('data-id');
// basitçe listeden meta bul
// performans için son snapshot'ı değil, hızlı yeniden query de olur; burada sade tutuyoruz
// thread attach
const name = b.querySelector('strong')?.textContent || activeId;
attachThread(activeId, { userName: name });
});


formSend.addEventListener('submit', async (e)=>{
e.preventDefault();
const text = (inputSend.value || '').trim(); if (!text || !activeId) return;
try{
const adminId = auth?.currentUser?.uid || 'admin';
const { serverTimestamp } = await getFF();
const convRef = (await getFF()).doc(db, 'conversations', activeId);
await (await getFF()).addDoc((await getFF()).collection(convRef, 'messages'), { text, from: adminId, byAdmin: true, createdAt: serverTimestamp() });
await (await getFF()).setDoc(convRef, { lastMessage: text, updatedAt: serverTimestamp() }, { merge: true });
inputSend.value='';
}catch(err){ console.error(err); alert('Gönderilemedi: ' + err.message); }
});


listenConversations();
}


export default { mountAdminMessages };
