// RealReal Enhancer - Popup (v1.3)
// Tabs: Presets | My Items | Settings (with label management)

const EMOJIS = ['🔖','👗','👠','👜','💎','✨','🏷️','⭐','🛍️','💅','🧥','👒'];
const LABEL_COLORS = ['#27ae60','#3498db','#e74c3c','#9b59b6','#e67e22','#1abc9c','#f39c12','#e91e63'];
const LABEL_EMOJIS = ['🛒','📌','🎁','💡','👀','🔥','💰','🏷️'];

let presets = [], labels = [], savedItems = {}, settings = {};

document.addEventListener('DOMContentLoaded', async () => {
  const sync = await chrome.storage.sync.get(['presets', 'settings', 'labels']);
  const local = await chrome.storage.local.get(['savedItems']);
  presets = sync.presets || [];
  settings = sync.settings || { compactView: false, dimSold: true };
  labels = sync.labels || [];
  savedItems = local.savedItems || {};

  // Tabs
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(`tab-${t.dataset.tab}`).classList.add('active');
  }));

  renderPresets();
  renderItems();
  renderSettings();
  renderLabelsManager();
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function notify() { chrome.runtime.sendMessage({ type: 'REFRESH_CONTENT' }).catch(() => {}); }

// ── Presets Tab ──────────────────────────────────────────────
function renderPresets() {
  const ul = document.getElementById('preset-list');
  if (!presets.length) {
    ul.innerHTML = `<li class="empty">No presets yet<span>Save filters from the toolbar on The RealReal</span></li>`;
    return;
  }
  ul.innerHTML = presets.map((p) => `
    <li class="preset-item" data-id="${esc(p.id)}">
      <span class="p-emoji">${esc(p.emoji || '🔖')}</span>
      <div class="p-info"><div class="p-name">${esc(p.name)}</div><div class="p-desc">${esc(p.description || 'Click to apply')}</div></div>
      <div class="p-actions">
        <button class="p-btn edit" data-id="${esc(p.id)}">✎</button>
        <button class="p-btn del" data-id="${esc(p.id)}">✕</button>
      </div>
    </li>
    <li class="edit-form" data-eid="${esc(p.id)}">
      <div class="ef-row"><label>Name</label><input class="ef-name" value="${esc(p.name)}" maxlength="30"></div>
      <div class="ef-row"><label>Description</label><input class="ef-desc" value="${esc(p.description || '')}" maxlength="60"></div>
      <div class="ef-row"><label>Emoji</label><div class="ef-emojis">${EMOJIS.map((e) => `<button class="ef-emj${e === (p.emoji || '🔖') ? ' sel' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <div class="ef-actions"><button class="ef-cancel">Cancel</button><button class="ef-save" data-id="${esc(p.id)}">Save</button></div>
    </li>`).join('');

  // Navigate on click
  ul.querySelectorAll('.preset-item').forEach((li) => li.addEventListener('click', (e) => {
    if (e.target.closest('.p-btn')) return;
    const p = presets.find((x) => x.id === li.dataset.id);
    if (!p) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const u = new URL(tabs[0].url);
      const noFilter = ['/account','/cart','/checkout','/login','/signup','/settings','/orders','/help'];
      const shop = u.pathname !== '/' && u.pathname !== '' && !noFilter.some((s) => u.pathname.startsWith(s));
      const url = (shop && (p.search || p.hash)) ? u.origin + u.pathname + (p.search || '') + (p.hash || '') : (p.fullUrl || p.url);
      chrome.tabs.update(tabs[0].id, { url }); window.close();
    });
  }));

  // Edit
  ul.querySelectorAll('.p-btn.edit').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    ul.querySelectorAll('.edit-form.open').forEach((f) => f.classList.remove('open'));
    ul.querySelector(`.edit-form[data-eid="${b.dataset.id}"]`)?.classList.add('open');
  }));
  ul.querySelectorAll('.ef-cancel').forEach((b) => b.addEventListener('click', () => b.closest('.edit-form').classList.remove('open')));
  ul.querySelectorAll('.ef-emojis').forEach((row) => row.querySelectorAll('.ef-emj').forEach((b) => b.addEventListener('click', () => {
    row.querySelectorAll('.ef-emj').forEach((x) => x.classList.remove('sel')); b.classList.add('sel');
  })));
  ul.querySelectorAll('.ef-save').forEach((b) => b.addEventListener('click', async () => {
    const form = b.closest('.edit-form'), i = presets.findIndex((p) => p.id === b.dataset.id);
    if (i === -1) return;
    const name = form.querySelector('.ef-name').value.trim(); if (!name) return;
    presets[i].name = name;
    presets[i].description = form.querySelector('.ef-desc').value.trim();
    const em = form.querySelector('.ef-emj.sel'); if (em) presets[i].emoji = em.dataset.e;
    await chrome.storage.sync.set({ presets }); notify(); renderPresets();
  }));

  // Delete
  ul.querySelectorAll('.p-btn.del').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    presets = presets.filter((p) => p.id !== b.dataset.id);
    await chrome.storage.sync.set({ presets }); notify(); renderPresets();
  }));
}

// ── My Items Tab ─────────────────────────────────────────────
function renderItems() {
  const section = document.getElementById('items-section');
  const itemKeys = Object.keys(savedItems);

  if (!itemKeys.length) {
    section.innerHTML = `<div class="empty">No saved items yet<span>Hover over items on The RealReal and click a label emoji to save</span></div>`;
    return;
  }

  // Group items by label
  const groups = {};
  labels.forEach((l) => { groups[l.id] = []; });
  groups['_unlabeled'] = [];

  itemKeys.forEach((key) => {
    const item = savedItems[key];
    if (!item.labels || !item.labels.length) { groups['_unlabeled'].push(item); return; }
    item.labels.forEach((lid) => {
      if (!groups[lid]) groups[lid] = [];
      groups[lid].push(item);
    });
  });

  let html = '';
  labels.forEach((l) => {
    const items = groups[l.id] || [];
    if (!items.length) return;
    html += `<div class="label-group">
      <div class="label-header">
        <span class="label-color" style="background:${l.color}"></span>
        <span class="label-name">${esc(l.emoji)} ${esc(l.name)}</span>
        <span class="label-count">(${items.length})</span>
      </div>
      ${items.map((item) => `
        <div class="saved-item" data-url="${esc(item.url)}">
          ${item.imageUrl ? `<img class="si-img" src="${esc(item.imageUrl)}" alt="">` : '<div class="si-img"></div>'}
          <div class="si-info">
            <div class="si-title">${esc(item.brand ? item.brand + ' — ' : '')}${esc(item.title)}</div>
            <div class="si-meta">${esc(item.price)}</div>
          </div>
          <button class="si-remove" data-key="${esc(item.key)}" data-label="${esc(l.id)}" title="Remove from ${esc(l.name)}">✕</button>
        </div>`).join('')}
    </div>`;
  });

  section.innerHTML = html || `<div class="empty">No items match any labels</div>`;

  // Click item to navigate
  section.querySelectorAll('.saved-item').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('.si-remove')) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) { chrome.tabs.update(tabs[0].id, { url: el.dataset.url }); window.close(); }
    });
  }));

  // Remove label from item
  section.querySelectorAll('.si-remove').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const key = btn.dataset.key, labelId = btn.dataset.label;
    if (savedItems[key]) {
      savedItems[key].labels = savedItems[key].labels.filter((l) => l !== labelId);
      if (!savedItems[key].labels.length) delete savedItems[key];
      await chrome.storage.local.set({ savedItems });
      notify(); renderItems();
    }
  }));
}

// ── Settings Tab ─────────────────────────────────────────────
function renderSettings() {
  const compact = document.getElementById('s-compact');
  const dim = document.getElementById('s-dim');
  compact.checked = settings.compactView || false;
  dim.checked = settings.dimSold !== undefined ? settings.dimSold : true;

  compact.addEventListener('change', async () => {
    settings.compactView = compact.checked;
    await chrome.storage.sync.set({ settings }); notify();
  });
  dim.addEventListener('change', async () => {
    settings.dimSold = dim.checked;
    await chrome.storage.sync.set({ settings }); notify();
  });
}

function renderLabelsManager() {
  const container = document.getElementById('labels-mgmt');
  container.innerHTML = labels.map((l, i) => `
    <div class="label-mgmt-item">
      <span class="lm-dot" style="background:${l.color}"></span>
      <span class="lm-emoji">${l.emoji}</span>
      <span class="lm-name">${esc(l.name)}</span>
      <button class="lm-del" data-idx="${i}" title="Delete label">✕</button>
    </div>`).join('');

  container.querySelectorAll('.lm-del').forEach((btn) => btn.addEventListener('click', async () => {
    const idx = parseInt(btn.dataset.idx);
    const labelId = labels[idx].id;
    labels.splice(idx, 1);
    // Remove this label from all saved items
    Object.keys(savedItems).forEach((key) => {
      if (savedItems[key].labels) {
        savedItems[key].labels = savedItems[key].labels.filter((l) => l !== labelId);
        if (!savedItems[key].labels.length) delete savedItems[key];
      }
    });
    await chrome.storage.sync.set({ labels });
    await chrome.storage.local.set({ savedItems });
    notify(); renderLabelsManager(); renderItems();
  }));

  // Add new label
  const addBtn = document.getElementById('add-label-btn');
  const nameInput = document.getElementById('new-label-name');

  addBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const colorIdx = labels.length % LABEL_COLORS.length;
    const emojiIdx = labels.length % LABEL_EMOJIS.length;
    labels.push({
      id: 'custom-' + Date.now(),
      name,
      emoji: LABEL_EMOJIS[emojiIdx],
      color: LABEL_COLORS[colorIdx],
    });
    await chrome.storage.sync.set({ labels });
    nameInput.value = '';
    notify(); renderLabelsManager();
  };
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
}
