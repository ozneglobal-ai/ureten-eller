// listings.js — ÜE Admin: İlanlar modülü
<td>${htmlesc(l.title||'—')}</td>
<td>${htmlesc(l.sellerName||l.sellerId||'—')}</td>
<td>${price}</td>
<td>${htmlesc(l.status||'—')}</td>
<td>${badge(l)||'—'}</td>
<td class="actions">
${l.status==='pending' ? '<button class="btn-xs" data-act="approve">Onayla</button> <button class="btn-xs danger" data-act="reject">Reddet</button>' : ''}
${l.status==='approved' ? '<button class="btn-xs" data-act="renew">Süreyi Yenile</button>' : ''}
${l.status==='expired' ? '<button class="btn-xs" data-act="republish">Yeniden Yayınla</button>' : ''}
${l.status==='rejected' ? '<button class="btn-xs" data-act="fix">Düzelt & Yeniden Gönder</button>' : ''}
${!l.showcase&&l.status==='approved' ? '<button class="btn-xs" data-act="showcase">Vitrine Öner</button>' : ''}
${l.showcase ? '<button class="btn-xs" data-act="unshowcase">Vitrinden Kaldır</button>' : ''}
<button class="btn-xs danger" data-act="delete">Sil</button>
</td>
</tr>
`);
}
}


container.addEventListener('click', async (e)=>{
const btn = e.target.closest('button[data-act]'); if(!btn) return;
const tr = btn.closest('tr[data-id]'); const id = tr?.dataset.id; if(!id) return;
btn.disabled = true;
try{
const i = cache.findIndex(x=>x.id===id); if(i<0) return;
const l = cache[i];
const patch = {};
const now = Date.now();
if (btn.dataset.act==='approve'){ patch.status='approved'; patch.expiresAt = now + LIFE_DAYS*DAY; }
else if(btn.dataset.act==='reject'){ patch.status='rejected'; patch.showcase=false; patch.showcasePending=false; }
else if(btn.dataset.act==='renew'){ patch.expiresAt = now + LIFE_DAYS*DAY; }
else if(btn.dataset.act==='republish'){ patch.status='pending'; }
else if(btn.dataset.act==='fix'){ patch.status='pending'; }
else if(btn.dataset.act==='showcase'){ patch.showcasePending=true; }
else if(btn.dataset.act==='unshowcase'){ patch.showcase=false; patch.showcasePending=false; }
else if(btn.dataset.act==='delete'){
// yumuşak silme: durum=deleted yap
patch.status='deleted';
}
await setDoc(doc(db,'listings',id), { ...patch, updatedAt: serverTimestamp() }, { merge:true });
Object.assign(cache[i], patch);
paint();
}catch(err){ console.error(err); alert('İşlem başarısız: '+err.message); }
finally{ btn.disabled=false; }
});


selStatus?.addEventListener('change', paint);
qInput?.addEventListener('input', paint);
btnReload?.addEventListener('click', load);


await load();
}


export default { mountAdminListings };
