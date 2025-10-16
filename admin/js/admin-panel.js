// admin/js/admin-panel.js

import { db } from "/firebase-init.js"; // kökten import (firebase-init.js kökteyse)
import {
  collection, query, where, getDocs, doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ========== YARDIMCI ========== */
function tsToMs(tsLike) {
  if (!tsLike) return 0;
  if (typeof tsLike?.toDate === "function") return tsLike.toDate().getTime();
  if (tsLike instanceof Date) return tsLike.getTime?.() || 0;
  return 0;
}

/* ========== DASHBOARD ========== */
async function loadMetrics() {
  const qs = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(query(collection(db, "listings"), where("status", "==", "approved"))),
    getDocs(query(collection(db, "listings"), where("status", "==", "pending"))),
    getDocs(query(collection(db, "orders"),   where("state", "in", ["open", "shipping"]))),
  ]);
  const g = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
  g("mUsers", qs[0].size);
  g("mListings", qs[1].size);
  g("mPending", qs[2].size);
  g("mOrders", qs[3].size);
}

/* ========== KULLANICILAR ========== */
const usersBody = document.getElementById("usersBody");
const qUser = document.getElementById("qUser");
const btnReloadUsers = document.getElementById("btnReloadUsers");

async function loadUsers() {
  if (!usersBody) return;
  usersBody.innerHTML = `<tr><td colspan="6">Yükleniyor…</td></tr>`;

  const snap = await getDocs(collection(db, "users"));
  const term = (qUser?.value || "").toLowerCase();

  const items = [];
  snap.forEach(d => {
    const u = d.data() || {};
    const fullName = u.fullName ?? u.full_name ?? "-";
    const email    = u.email ?? "-";
    const role     = u.role ?? "-";
    const city     = u.city ?? "-";
    const isPro    = (u.isPro ?? u.is_pro) === true;
    const banned   = u.banned === true;
    const created  = (u.createdAt ?? u.created_at);

    // filtre
    const f = String(fullName).toLowerCase();
    const m = String(email).toLowerCase();
    const c = String(city).toLowerCase();
    if (term && !(f.includes(term) || m.includes(term) || c.includes(term))) return;

    items.push({
      id: d.id, fullName, email, role, city, isPro, banned,
      createdMs: tsToMs(created), raw: u
    });
  });

  // yeni > eski
  items.sort((a,b)=> b.createdMs - a.createdMs);

  const rows = items.map(it => `
    <tr>
      <td>${it.fullName}</td>
      <td>${it.email}</td>
      <td>${it.role}</td>
      <td>${it.city}</td>
      <td>${it.isPro ? "PRO" : "-"}</td>
      <td>
        <button class="btn-sm" data-act="make-admin" data-id="${it.id}">Admin</button>
        <button class="btn-sm" data-act="toggle-pro" data-id="${it.id}">${it.isPro ? "PRO İptal" : "PRO Ver"}</button>
        <button class="btn-sm" data-act="ban" data-id="${it.id}">${it.banned ? "Ban Kaldır" : "Banla"}</button>
      </td>
    </tr>
  `);

  usersBody.innerHTML = rows.join("") || `<tr><td colspan="6">Kayıt yok.</td></tr>`;
}

usersBody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id  = btn.dataset.id;
  const act = btn.dataset.act;
  const ref = doc(db, "users", id);

  try{
    if (act === "make-admin") {
      await updateDoc(ref, { role: "admin" });
    } else if (act === "toggle-pro") {
      const isProNow = btn.textContent.includes("İptal");
      const newVal = !isProNow;
      await updateDoc(ref, { isPro: newVal, is_pro: newVal });
    } else if (act === "ban") {
      const isBanNow = btn.textContent.includes("Kaldır");
      await updateDoc(ref, { banned: !isBanNow });
    }
    await loadUsers();
  }catch(err){
    alert(`Kullanıcı güncellenemedi: ${err?.code||""} ${err?.message||err}`);
  }
});

btnReloadUsers?.addEventListener("click", loadUsers);
qUser?.addEventListener("input", loadUsers);

/* ========== İLANLAR ========== */
const listingFilter = document.getElementById("listingFilter");
const listingsBody = document.getElementById("listingsBody");
const btnReloadListings = document.getElementById("btnReloadListings");

async function loadListings() {
  if (!listingsBody) return;
  listingsBody.innerHTML = `<tr><td colspan="6">Yükleniyor…</td></tr>`;
  const st = listingFilter?.value || "pending";

  const q = query(collection(db, "listings"), where("status", "==", st));
  const snap = await getDocs(q);

  const items = [];
  snap.forEach(d => {
    const l = d.data() || {};
    const title       = l.title ?? "-";
    const sellerName  = l.sellerName ?? l.seller_name ?? "-";
    const status      = l.status ?? "-";
    const featured    = l.featured === true;
    const created     = l.createdAt ?? l.created_at;
    items.push({
      id: d.id,
      title, sellerName, status, featured,
      createdMs: tsToMs(created),
    });
  });

  items.sort((a,b)=> b.createdMs - a.createdMs);

  const rows = items.map(it => `
    <tr>
      <td>${it.title}</td>
      <td>${it.sellerName}</td>
      <td>${it.status}</td>
      <td>${it.featured ? "Vitrin" : "-"}</td>
      <td>${it.createdMs ? new Date(it.createdMs).toLocaleString() : "-"}</td>
      <td>
        <button class="btn-sm" data-l="${it.id}" data-act="approve">Onayla</button>
        <button class="btn-sm" data-l="${it.id}" data-act="reject">Reddet</button>
        <button class="btn-sm" data-l="${it.id}" data-act="feature">${it.featured ? "Vitrinden İndir" : "Vitrine Al"}</button>
        <button class="btn-sm" data-l="${it.id}" data-act="delete">Sil</button>
      </td>
    </tr>
  `);

  listingsBody.innerHTML = rows.join("") || `<tr><td colspan="6">Kayıt yok.</td></tr>`;
}

listingsBody?.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const ref = doc(db, "listings", b.dataset.l);
  const act = b.dataset.act;

  try{
    if (act === "approve") await updateDoc(ref, { status: "approved" });
    if (act === "reject")  await updateDoc(ref, { status: "rejected" });
    if (act === "feature") {
      const s = await getDoc(ref);
      const cur = s.exists() ? !!s.data().featured : false;
      await updateDoc(ref, { featured: !cur });
    }
    if (act === "delete")  await updateDoc(ref, { deleted: true, status: "deleted" });
    await loadListings();
  }catch(err){
    alert(`İlan güncellenemedi: ${err?.code||""} ${err?.message||err}`);
  }
});

btnReloadListings?.addEventListener("click", loadListings);
listingFilter?.addEventListener("change", loadListings);

/* ========== INIT: guard sinyali sonrası başlat ========== */
async function initPanel() {
  try {
    await loadMetrics();
    await loadUsers();
    await loadListings();
  } catch (e) {
    console.error("initPanel error:", e);
    alert(`Panel yüklenemedi: ${e?.code || ""} ${e?.message || e}`);
  }
}

// Guard "admin-ready" olayı yayınladığında başlat
window.addEventListener("admin-ready", initPanel);

// Guard daha önce bitirdiyse (sayfa çok hızlı yüklendiyse) hemen başlat
if (document.body.dataset.ready === "1") {
  initPanel();
}
