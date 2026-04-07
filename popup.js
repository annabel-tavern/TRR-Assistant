// RealReal Enhancer - Popup (v2.1 — custom labels)

var LABEL_COLORS = ['#27ae60', '#3498db', '#e74c3c', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#e91e63', '#2ecc71', '#8e44ad'];
var LABEL_EMOJIS = ['🛒', '📌', '🎁', '💡', '👀', '🔥', '💰', '🏷️', '💅', '🧥', '👗', '👠', '👜', '💎', '✨', '⭐', '🛍️', '👒', '🎀', '💝', '📦', '🌟', '🔔', '💌'];

var currentSettings = {};
var currentLabels = [];
var currentSavedItems = {};

function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

// ── Tabs ─────────────────────────────────────────
document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (x) { x.classList.remove('active'); });
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  });
});

// ── Load and render ──────────────────────────────
chrome.storage.sync.get(['presets', 'settings', 'labels'], function (sync) {
  chrome.storage.local.get(['savedItems'], function (local) {
    var presets = (sync && sync.presets) || [];
    currentLabels = (sync && sync.labels) || [
      { id: 'want-to-buy', name: 'Want to Buy', emoji: '🛒', color: '#27ae60' },
      { id: 'reference', name: 'Reference', emoji: '📌', color: '#3498db' },
      { id: 'gift', name: 'For a Gift', emoji: '🎁', color: '#e74c3c' }
    ];
    currentSettings = (sync && sync.settings) || {};
    currentSavedItems = (local && local.savedItems) || {};

    // Status
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.indexOf('therealreal.com') !== -1) {
        document.getElementById('status-dot').className = 'status-dot on';
      }
    });

    renderItems(currentSavedItems, currentLabels);
    renderPresets(presets);
    renderLabelsManager();
    setupEmojiPicker();
    setupAddLabel();
    setupSettings();
  });
});

// ── Render My Items ──────────────────────────────
function renderItems(savedItems, labels) {
  var section = document.getElementById('items-section');
  var keys = Object.keys(savedItems);

  if (!keys.length) {
    section.innerHTML = '<div class="empty">No saved items yet — hover over items on The RealReal and tap a label emoji to save</div>';
    return;
  }

  var html = '';
  labels.forEach(function (l) {
    var groupKeys = keys.filter(function (k) {
      return savedItems[k].labels && savedItems[k].labels.indexOf(l.id) !== -1;
    });
    if (!groupKeys.length) return;

    html += '<div class="label-group">';
    html += '<div class="label-header"><span class="label-dot" style="background:' + l.color + '"></span>';
    html += '<span class="label-name">' + l.emoji + ' ' + escHtml(l.name) + '</span>';
    html += '<span class="label-count">(' + groupKeys.length + ')</span></div>';

    groupKeys.forEach(function (k) {
      var item = savedItems[k];
      if (!item) return;
      html += '<div class="saved-item" data-url="' + escHtml(item.url || '') + '">';
      html += '<div class="si-info">';
      if (item.brand) html += '<div class="si-brand">' + escHtml(item.brand) + '</div>';
      html += '<div class="si-title">' + escHtml(item.title || 'Unknown Item') + '</div>';
      html += '</div>';
      if (item.price) html += '<span class="si-price">' + escHtml(item.price) + '</span>';
      html += '</div>';
    });
    html += '</div>';
  });

  if (!html) { section.innerHTML = '<div class="empty">No saved items yet</div>'; return; }
  section.innerHTML = html;

  section.querySelectorAll('.saved-item').forEach(function (el) {
    el.addEventListener('click', function () {
      if (el.dataset.url) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) { chrome.tabs.update(tabs[0].id, { url: el.dataset.url }); window.close(); }
        });
      }
    });
  });
}

// ── Render Presets ────────────────────────────────
function renderPresets(presets) {
  var pills = document.getElementById('presets-pills');
  if (presets.length > 0) {
    var html = '';
    for (var j = 0; j < presets.length; j++) {
      var p = presets[j];
      html += '<button class="preset-pill" data-search="' + escAttr(p.search || '') + '" data-hash="' + escAttr(p.hash || '') + '" data-url="' + escAttr(p.fullUrl || '') + '">' + escHtml(p.emoji || '🔖') + ' ' + escHtml(p.name) + '</button>';
    }
    pills.innerHTML = html;
    pills.querySelectorAll('.preset-pill').forEach(function (el) {
      el.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (!tabs[0]) return;
          var u = new URL(tabs[0].url);
          var noF = ['/account', '/cart', '/checkout', '/login', '/signup', '/settings', '/orders', '/help'];
          var ok = u.pathname !== '/' && !noF.some(function (p) { return u.pathname.startsWith(p); });
          var url;
          if (ok && (el.dataset.search || el.dataset.hash)) {
            if (u.pathname === '/products' || u.pathname.startsWith('/products/')) {
              var kw = u.searchParams.get('keywords');
              if (kw) {
                var pp = new URLSearchParams(el.dataset.search);
                pp.set('keywords', kw);
                url = u.origin + u.pathname + '?' + pp.toString() + (el.dataset.hash || '');
              } else {
                url = u.origin + u.pathname + el.dataset.search + (el.dataset.hash || '');
              }
            } else {
              url = u.origin + u.pathname + el.dataset.search + (el.dataset.hash || '');
            }
          } else {
            url = el.dataset.url;
          }
          chrome.tabs.update(tabs[0].id, { url: url }); window.close();
        });
      });
    });
  } else {
    pills.innerHTML = '<span class="no-presets">Save filters from the toolbar on TRR</span>';
  }
}

// ── Labels Manager ───────────────────────────────
function renderLabelsManager() {
  var list = document.getElementById('labels-list');
  var keys = Object.keys(currentSavedItems);

  var html = '';
  currentLabels.forEach(function (l, i) {
    // Count items with this label
    var count = keys.filter(function (k) {
      return currentSavedItems[k].labels && currentSavedItems[k].labels.indexOf(l.id) !== -1;
    }).length;

    html += '<div class="label-item" data-idx="' + i + '">';
    html += '<span class="label-item-dot" style="background:' + l.color + '"></span>';
    html += '<span class="label-item-emoji">' + l.emoji + '</span>';
    html += '<span class="label-item-name">' + escHtml(l.name) + '</span>';
    if (count > 0) html += '<span class="label-item-count">' + count + ' items</span>';
    html += '<button class="label-item-del" data-idx="' + i + '" title="Delete label">✕</button>';
    html += '</div>';
  });

  list.innerHTML = html;

  // Delete handlers
  list.querySelectorAll('.label-item-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(btn.dataset.idx);
      var labelId = currentLabels[idx].id;

      // Remove this label from all saved items
      var keys = Object.keys(currentSavedItems);
      keys.forEach(function (k) {
        if (currentSavedItems[k].labels) {
          currentSavedItems[k].labels = currentSavedItems[k].labels.filter(function (l) { return l !== labelId; });
          if (currentSavedItems[k].labels.length === 0) delete currentSavedItems[k];
        }
      });

      currentLabels.splice(idx, 1);
      chrome.storage.sync.set({ labels: currentLabels });
      chrome.storage.local.set({ savedItems: currentSavedItems });
      chrome.runtime.sendMessage({ type: 'REFRESH_CONTENT' });
      renderLabelsManager();
      renderItems(currentSavedItems, currentLabels);
    });
  });
}

// ── Emoji Picker ─────────────────────────────────
var selectedEmoji = '💡';

function setupEmojiPicker() {
  var picker = document.getElementById('emoji-picker');
  var html = '';
  LABEL_EMOJIS.forEach(function (e) {
    // Skip emojis already used by existing labels
    var used = currentLabels.some(function (l) { return l.emoji === e; });
    if (used) return;
    html += '<button class="emoji-pick' + (e === selectedEmoji ? ' sel' : '') + '" data-emoji="' + e + '">' + e + '</button>';
  });
  picker.innerHTML = html;

  // Select first available emoji by default
  var first = picker.querySelector('.emoji-pick');
  if (first) {
    first.classList.add('sel');
    selectedEmoji = first.dataset.emoji;
  }

  picker.querySelectorAll('.emoji-pick').forEach(function (btn) {
    btn.addEventListener('click', function () {
      picker.querySelectorAll('.emoji-pick').forEach(function (b) { b.classList.remove('sel'); });
      btn.classList.add('sel');
      selectedEmoji = btn.dataset.emoji;
    });
  });
}

// ── Add Label ────────────────────────────────────
function setupAddLabel() {
  var nameInput = document.getElementById('new-label-name');
  var addBtn = document.getElementById('add-label-btn');

  function addLabel() {
    var name = nameInput.value.trim();
    if (!name) return;

    // Pick a color (cycle through available colors)
    var colorIdx = currentLabels.length % LABEL_COLORS.length;

    currentLabels.push({
      id: 'custom-' + Date.now(),
      name: name,
      emoji: selectedEmoji,
      color: LABEL_COLORS[colorIdx]
    });

    chrome.storage.sync.set({ labels: currentLabels });
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTENT' });
    nameInput.value = '';
    renderLabelsManager();
    setupEmojiPicker(); // refresh to remove used emoji
  }

  addBtn.addEventListener('click', addLabel);
  nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') addLabel(); });
}

// ── Settings ─────────────────────────────────────
function setupSettings() {
  var compact = document.getElementById('s-compact');
  var dim = document.getElementById('s-dim');
  compact.checked = currentSettings.compactView || false;
  dim.checked = currentSettings.dimSold !== undefined ? currentSettings.dimSold : true;

  compact.addEventListener('change', function () {
    currentSettings.compactView = compact.checked;
    chrome.storage.sync.set({ settings: currentSettings });
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTENT' });
  });
  dim.addEventListener('change', function () {
    currentSettings.dimSold = dim.checked;
    chrome.storage.sync.set({ settings: currentSettings });
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTENT' });
  });
}
