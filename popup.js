// RealReal Enhancer - Popup (external JS, Manifest V3 compatible)

function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function escAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

var currentSettings = {};

chrome.storage.sync.get(['presets', 'settings', 'labels'], function (sync) {
  chrome.storage.local.get(['savedItems'], function (local) {
    var presets = (sync && sync.presets) || [];
    var labels = (sync && sync.labels) || [];
    currentSettings = (sync && sync.settings) || {};
    var savedItems = (local && local.savedItems) || {};

    // Status
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.indexOf('therealreal.com') !== -1) {
        document.getElementById('status-dot').className = 'status-dot on';
      }
    });

    // Stats
    var itemCount = Object.keys(savedItems).length;
    document.getElementById('stat-items').textContent = itemCount;
    document.getElementById('stat-labels').textContent = labels.length;
    document.getElementById('stat-presets').textContent = presets.length;

    // Presets
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

    // Settings
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
