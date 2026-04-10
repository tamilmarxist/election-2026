const cardsEl = document.getElementById("cards");
const searchEl = document.getElementById("search");
const statsEl = document.getElementById("stats");
const taglineEl = document.getElementById("tagline");
const footerSloganEl = document.getElementById("footerSlogan");
const footerMetaEl = document.getElementById("footerMeta");
const pdfLink = document.getElementById("pdfLink");
const categoryFiltersEl = document.getElementById("categoryFilters");

const modalEl = document.getElementById("sectionModal");
const modalCloseEl = document.getElementById("modalClose");
const modalTitleEl = document.getElementById("modalTitle");
const modalCountEl = document.getElementById("modalCount");
const modalContentEl = document.getElementById("modalContent");
const modalShareEl = document.getElementById("modalShare");
const modalCopyEl = document.getElementById("modalCopy");
const modalPdfEl = document.getElementById("modalPdf");
const toastEl = document.getElementById("toast");

let manifesto = { meta: {}, sections: [] };
let activeCategory = "all";
let activeSection = null;
let toastTimer = null;

function truncate(s, max) {
  if (!s) return "";
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max).trimEnd();
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return base + "…";
}

function prosePlainPreview(raw) {
  if (!raw) return "";
  let t = raw.replace(/^1\.\s*தமிழக வாக்காளர்களுக்கு வேண்டுகோள்\s*\n+/m, "");
  t = t.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  return truncate(t, 168);
}

function normalize(s) {
  return (s || "").toLowerCase();
}

function sectionIdsForCategory(key) {
  if (key === "all") return null;
  const cat = (manifesto.meta.categories || []).find((c) => c.key === key);
  return cat?.section_ids ?? [];
}

function sectionInCategory(secId, key) {
  const ids = sectionIdsForCategory(key);
  if (ids === null) return true;
  return ids.includes(secId);
}

function sectionMatchesQuery(section, q) {
  if (!q) return true;
  const hay = normalize(`${section.title} ${(section.bullets || []).join(" ")} ${section.prose || ""}`);
  return q.split(/\s+/).every((word) => word.length === 0 || hay.includes(word));
}

function clearHash() {
  const u = new URL(location.href);
  history.replaceState(null, "", u.pathname + u.search);
}

function sectionUrl(sec) {
  return new URL(location.pathname + location.search + `#section-${sec.id}`, location.origin).href;
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 1800);
}

function cleanBullet(s) {
  return s.replace(/^•\s*/, "").replace(/^[•\u2022]\t?/, "").trim();
}

function formatProseToHtml(raw) {
  let text = raw.replace(/^1\.\s*தமிழக வாக்காளர்களுக்கு வேண்டுகோள்\s*\n+/m, "");
  const parts = text.split(/\n\n+/);
  return parts.map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderCategoryChips() {
  categoryFiltersEl.innerHTML = "";
  const cats = manifesto.meta.categories || [{ key: "all", label_ta: "அனைத்து பிரிவுகள்" }];
  for (const c of cats) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("role", "tab");
    b.dataset.category = c.key;
    b.textContent = c.label_ta;
    b.setAttribute("aria-selected", c.key === activeCategory ? "true" : "false");
    b.addEventListener("click", () => {
      activeCategory = c.key;
      renderCategoryChips();
      render();
    });
    categoryFiltersEl.appendChild(b);
  }
}

function openModal(sec) {
  if (!sec || typeof sec.id !== "number") {
    showToast("Category content not found");
    return;
  }
  activeSection = sec;
  modalTitleEl.textContent = sec.title;
  const n = sec.bullets?.length || 0;
  modalCountEl.textContent = sec.prose && n === 0 ? "முன்னுரை" : `${n} கோரிக்கைகள் / நிலைப்பாடுகள்`;

  if (sec.prose && n === 0) {
    modalContentEl.innerHTML = formatProseToHtml(sec.prose);
  } else {
    const items = (sec.bullets || []).map((b) => `<li>${escapeHtml(cleanBullet(b))}</li>`).join("");
    modalContentEl.innerHTML = items ? `<ul>${items}</ul>` : "<p>No content available.</p>";
  }

  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", `#section-${sec.id}`);
}

function openModalById(sectionId) {
  const sec = manifesto.sections.find((s) => s.id === sectionId);
  openModal(sec);
}

function closeModal() {
  modalEl.hidden = true;
  document.body.style.overflow = "";
  activeSection = null;
  clearHash();
}

function wireModalActions() {
  modalCloseEl.addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalEl.hidden) closeModal();
  });

  modalCopyEl.addEventListener("click", () => {
    if (!activeSection) return;
    const url = sectionUrl(activeSection);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast("Link copied"))
        .catch(() => showToast("Could not copy link"));
    } else {
      showToast("Clipboard not supported");
    }
  });

  modalShareEl.addEventListener("click", async () => {
    if (!activeSection) return;
    const url = sectionUrl(activeSection);
    const title = activeSection.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} - சிபிஐ(எம்) தேர்தல் அறிக்கை`, url });
        showToast("Shared");
      } catch {
        showToast("Share cancelled");
      }
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast("Share not available. Link copied"))
        .catch(() => showToast("Share not available"));
    } else {
      showToast("Share not available");
    }
  });

  if (modalPdfEl) {
    modalPdfEl.remove();
  }
}

function render() {
  const q = normalize(searchEl.value.trim());
  let visible = 0;
  let totalBullets = 0;
  cardsEl.innerHTML = "";

  for (const sec of manifesto.sections) {
    const n = sec.bullets?.length || 0;
    if (n) totalBullets += n;
    if (!sectionInCategory(sec.id, activeCategory)) continue;
    if (!sectionMatchesQuery(sec, q)) continue;

    visible++;
    const isProse = sec.prose && (!sec.bullets || sec.bullets.length === 0);
    const countLabel = isProse ? "முன்னுரை" : `${n} கோரிக்கைகள் / நிலைப்பாடுகள்`;

    let previewText = "";
    let moreText = "";
    if (isProse) {
      previewText = prosePlainPreview(sec.prose);
      moreText = "முழு முன்னுரையைக் காண்க →";
    } else if (n > 0) {
      previewText = truncate(cleanBullet(sec.bullets[0]), 150);
      if (n > 1) moreText = `+ ${n - 1} மேலும்…`;
    }

    const card = document.createElement("article");
    card.className = "card";
    card.id = `section-${sec.id}`;

    const shell = document.createElement("div");
    shell.className = "card-shell";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-face";

    const headline = document.createElement("div");
    headline.className = "card-headline";

    const num = document.createElement("span");
    num.className = "card-num";
    num.textContent = String(sec.id);

    const titleWrap = document.createElement("div");
    titleWrap.className = "card-title-wrap";
    const h2 = document.createElement("h2");
    h2.className = "card-title";
    h2.textContent = sec.title;
    titleWrap.appendChild(h2);

    const countEl = document.createElement("p");
    countEl.className = "card-count";
    countEl.textContent = countLabel;

    const previewEl = document.createElement("p");
    previewEl.className = "card-preview";
    previewEl.textContent = previewText;
    if (!previewText) previewEl.hidden = true;

    const moreEl = document.createElement("p");
    moreEl.className = "card-more";
    moreEl.textContent = moreText;
    if (!moreText) moreEl.hidden = true;

    headline.appendChild(num);
    headline.appendChild(titleWrap);

    btn.appendChild(headline);
    btn.appendChild(countEl);
    btn.appendChild(previewEl);
    btn.appendChild(moreEl);

    btn.addEventListener("click", () => openModalById(sec.id));

    shell.appendChild(btn);
    card.appendChild(shell);
    cardsEl.appendChild(card);
  }

  const total = manifesto.sections.length;
  const catLabel = (manifesto.meta.categories || []).find((c) => c.key === activeCategory)?.label_ta || "";
  const statsParts = [];
  if (q) statsParts.push(`${visible} பிரிவு(கள்) தேடலுக்குப் பொருந்துகின்றன`);
  if (activeCategory !== "all") statsParts.push(`${catLabel}: ${visible} பிரிவுகள்`);

  if (!q && activeCategory === "all") {
    statsEl.textContent = `${total} பிரிவுகள் · சுமார் ${totalBullets}+ கோரிக்கைகள்`;
  } else {
    statsEl.textContent = statsParts.join(" · ") + ` (மொத்தம் ${total} பிரிவுகள்)`;
  }
}

function applyHashFromUrl() {
  const m = /^#section-(\d+)$/.exec(location.hash);
  if (!m) return;
  const id = parseInt(m[1], 10);
  openModalById(id);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const ok = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!ok) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function clearOldCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore cache-clear failures
  }
}

async function load() {
  await clearOldCaches();
  const res = await fetch("data/manifesto.json");
  if (!res.ok) throw new Error("manifesto load failed");
  manifesto = await res.json();

  document.getElementById("partyName").textContent = manifesto.meta.party_ta || "";
  const docFull = manifesto.meta.document_ta || "";
  const emDash = docFull.indexOf("—") >= 0 ? "—" : docFull.indexOf("–") >= 0 ? "–" : null;
  document.getElementById("docTitle").textContent = emDash ? docFull.split(emDash).pop().trim() : docFull || "தேர்தல் அறிக்கை";
  taglineEl.textContent = manifesto.meta.tagline_ta || "";
  footerSloganEl.textContent = manifesto.meta.tagline_ta || "";
  footerMetaEl.textContent = `${manifesto.meta.party_ta || ""} · ${manifesto.meta.date || ""}`;

  const pdf = manifesto.meta.pdf_url || "asset/CPIM_Election_Manifesto_2026.pdf";
  pdfLink.href = pdf;
  pdfLink.download = pdf.split("/").pop() || "CPIM_Election_Manifesto_2026.pdf";

  wireModalActions();
  renderCategoryChips();
  searchEl.addEventListener("input", render);
  window.addEventListener("hashchange", applyHashFromUrl);

  render();
  if (location.hash && /^#section-\d+$/.test(location.hash)) {
    applyHashFromUrl();
  }

  // keep disabled for now to prevent stale cached UI during iteration
  // registerServiceWorker();
}

load().catch((e) => {
  statsEl.textContent = "தரவை ஏற்ற முடியவில்லை. உள்ளூர் சேவையகத்துடன் திறக்கவும்.";
  console.error(e);
});
