// RealReal Enhancer - Popup (external JS, Manifest V3 compatible)

function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

var currentSettings = {};

// ── Tabs ─────────────────────────────────────────
document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (x) { x.classList.remove('active'); });
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  });
});

// ── Load data and render ─────────────────────────
chrome.storage.sync.get(['presets', 'settings', 'labels'], function (sync) {
  chrome.storage.local.get(['savedItems'], function (local) {
    var presets = (sync && sync.presets) || [];
    var labels = (sync && sync.labels) || [
      { id: 'want-to-buy', name: 'Want to Buy', emoji: '🛒', color: '#27ae60' },
      { id: 'reference', name: 'Reference', emoji: '📌', color: '#3498db' },
      { id: 'gift', name: 'For a Gift', emoji: '🎁', color: '#e74c3c' }
    ];
    currentSettings = (sync && sync.settings) || {};
    var savedItems = (local && local.savedItems) || {};

    // Status dot
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.indexOf('therealreal.com') !== -1) {
        document.getElementById('status-dot').className = 'status-dot on';
      }
    });

    // ── Render My Items ────────────────────────────
    renderItems(savedItems, labels);

    // ── Render Presets ─────────────────────────────
    renderPresets(presets);

    // ── Settings ───────────────────────────────────
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
  });
});

// ── Render saved items grouped by label ──────────
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
      if (item.imageUrl) {
        html += '<img class="si-img" src="' + escHtml(item.imageUrl) + '" loading="lazy">';
      } else {
        html += '<div class="si-placeholder"></div>';
      }
      html += '<div class="si-info">';
      if (item.brand) html += '<div class="si-brand">' + escHtml(item.brand) + '</div>';
      html += '<div class="si-title">' + escHtml(item.title || 'Unknown Item') + '</div>';
      html += '</div>';
      if (item.price) html += '<span class="si-price">' + escHtml(item.price) + '</span>';
      html += '</div>';
    });

    html += '</div>';
  });

  if (!html) {
    section.innerHTML = '<div class="empty">No saved items yet</div>';
    return;
  }

  section.innerHTML = html;

  // Click to navigate to item
  section.querySelectorAll('.saved-item').forEach(function (el) {
    el.addEventListener('click', function () {
      if (el.dataset.url) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: el.dataset.url });
            window.close();
          }
        });
      }
    });
  });
}

// ── Render presets ───────────────────────────────
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
          var url = (ok && (el.dataset.search || el.dataset.hash)) ? u.origin + u.pathname + el.dataset.search + el.dataset.hash : el.dataset.url;
          chrome.tabs.update(tabs[0].id, { url: url });
          window.close();
        });
      });
    });
  } else {
    pills.innerHTML = '<span class="no-presets">Save filters from the toolbar on TRR</span>';
  }
}
