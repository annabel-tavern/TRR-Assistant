// RealReal Enhancer - Toolbar (filter presets, compact view, dim sold)

(function () {
  'use strict';
  if (document.getElementById('trr-enhancer-toolbar')) return;

  var presets = [];
  var settings = { compactView: false, dimSold: true, toolbarCollapsed: false };
  var editingPresetId = null;

  function esc(str) { var d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

  function isShopPage(path) {
    var noFilter = ['/account', '/cart', '/checkout', '/login', '/signup', '/settings', '/orders', '/help'];
    if (path === '/' || path === '') return false;
    return !noFilter.some(function (p) { return path.startsWith(p); });
  }

  function decodeFilters(search) {
    if (!search) return 'None';
    try {
      var params = new URLSearchParams(search);
      var parts = [];
      params.forEach(function (v, k) {
        parts.push(k.replace(/\[\]/g, '').replace(/_/g, ' ') + ': ' + decodeURIComponent(v).replace(/\+/g, ' '));
      });
      return parts.join(', ') || 'None';
    } catch (e) { return search.replace(/^\?/, ''); }
  }

  function loadData(callback) {
    chrome.storage.sync.get(['presets', 'settings'], function (d) {
      presets = (d && d.presets) || [];
      settings = { compactView: false, dimSold: true, toolbarCollapsed: false };
      if (d && d.settings) {
        if (d.settings.compactView !== undefined) settings.compactView = d.settings.compactView;
        if (d.settings.dimSold !== undefined) settings.dimSold = d.settings.dimSold;
        if (d.settings.toolbarCollapsed !== undefined) settings.toolbarCollapsed = d.settings.toolbarCollapsed;
      }
      if (callback) callback();
    });
  }

  function saveSettings() { chrome.storage.sync.set({ settings: settings }); }
  function savePresets() { chrome.storage.sync.set({ presets: presets }); }

  function init() {
    loadData(function () {
      createToolbar();
      applySettings();
      observeForSoldItems();
      listenForMessages();
    });
  }

  function createToolbar() {
    var tb = document.createElement('div');
    tb.id = 'trr-enhancer-toolbar';
    tb.innerHTML = buildToolbarHTML();
    document.body.appendChild(tb);
    if (settings.toolbarCollapsed) tb.classList.add('trr-collapsed');
    attachEvents(tb);
  }

  function buildToolbarHTML() {
    var btns = presets.map(function (p) {
      return '<div class="trr-preset-wrap" data-pid="' + esc(p.id) + '">' +
        '<button class="trr-preset-btn" data-pid="' + esc(p.id) + '" title="' + esc(p.name) + (p.description ? '\n' + esc(p.description) : '') + '\nClick=apply | Shift+Click=original page">' +
        '<span class="trr-preset-icon">' + esc(p.emoji || '🔖') + '</span>' +
        '<span class="trr-preset-name">' + esc(p.name) + '</span></button>' +
        '<div class="trr-preset-actions">' +
        '<button class="trr-pa-edit" data-pid="' + esc(p.id) + '" title="Edit">✎</button>' +
        '<button class="trr-pa-del" data-pid="' + esc(p.id) + '" title="Delete">✕</button>' +
        '</div></div>';
    }).join('');

    return '<div class="trr-toolbar-inner">' +
      '<div class="trr-toolbar-brand" id="trr-toggle-collapse">' +
      '<span class="trr-logo">⚡</span><span class="trr-brand-text">RealReal Enhancer</span>' +
      '<span class="trr-collapse-arrow" id="trr-collapse-arrow">' + (settings.toolbarCollapsed ? '▲' : '▼') + '</span></div>' +
      '<div class="trr-toolbar-content" id="trr-toolbar-content">' +
      '<div class="trr-presets-section"><div class="trr-presets-list">' +
      (btns || '<span class="trr-no-presets">No presets yet</span>') +
      '</div><button class="trr-save-btn" id="trr-save-current">+ Save Current Filters</button></div>' +
      '<div class="trr-divider"></div>' +
      '<div class="trr-toggles-section">' +
      '<label class="trr-toggle"><input type="checkbox" id="trr-compact-toggle" ' + (settings.compactView ? 'checked' : '') + '><span class="trr-toggle-slider"></span><span class="trr-toggle-label">Compact</span></label>' +
      '<label class="trr-toggle"><input type="checkbox" id="trr-dim-toggle" ' + (settings.dimSold ? 'checked' : '') + '><span class="trr-toggle-slider"></span><span class="trr-toggle-label">Dim Sold</span></label>' +
      '</div></div></div>' +
      // Save/Edit modal
      '<div class="trr-modal-overlay" id="trr-save-modal" style="display:none"><div class="trr-modal">' +
      '<h3 id="trr-modal-title">Save Filter Preset</h3>' +
      '<div class="trr-modal-context" id="trr-modal-context"></div>' +
      '<div class="trr-filter-source" id="trr-filter-source" style="display:none">' +
      '<span class="trr-fs-label">Filters</span><div class="trr-fs-options">' +
      '<label class="trr-radio"><input type="radio" name="trr-fsrc" value="keep" checked><span>Keep existing</span></label>' +
      '<label class="trr-radio"><input type="radio" name="trr-fsrc" value="update"><span>Update from this page</span></label>' +
      '</div></div>' +
      '<div class="trr-mf"><label>Name</label><input type="text" id="trr-inp-name" maxlength="30" placeholder="e.g. Basics, Shoe Hunt..."></div>' +
      '<div class="trr-mf"><label>Description</label><input type="text" id="trr-inp-desc" maxlength="60" placeholder="e.g. Size M, Like New, Low to High"></div>' +
      '<div class="trr-mf"><label>Emoji</label><div class="trr-emoji-picker">' +
      ['🔖','👗','👠','👜','💎','✨','🏷️','⭐','🛍️','💅','🧥','👒'].map(function (e) { return '<button class="trr-emoji-btn" data-emoji="' + e + '">' + e + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="trr-modal-actions"><button class="trr-btn-cancel" id="trr-modal-cancel">Cancel</button><button class="trr-btn-save" id="trr-modal-save">Save</button></div>' +
      '</div></div>' +
      // Delete modal
      '<div class="trr-modal-overlay" id="trr-delete-modal" style="display:none"><div class="trr-modal trr-modal-sm">' +
      '<h3>Delete Preset?</h3><p id="trr-del-name"></p>' +
      '<div class="trr-modal-actions"><button class="trr-btn-cancel" id="trr-del-cancel">Keep</button><button class="trr-btn-delete" id="trr-del-confirm">Delete</button></div>' +
      '</div></div>';
  }

  function attachEvents(tb) {
    tb.querySelector('#trr-toggle-collapse').addEventListener('click', function () {
      tb.classList.toggle('trr-collapsed');
      settings.toolbarCollapsed = tb.classList.contains('trr-collapsed');
      tb.querySelector('#trr-collapse-arrow').textContent = settings.toolbarCollapsed ? '▲' : '▼';
      saveSettings();
    });

    tb.querySelectorAll('.trr-preset-btn').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); var p = presets.find(function (x) { return x.id === b.dataset.pid; }); if (p) navPreset(p, e.shiftKey); });
    });
    tb.querySelectorAll('.trr-pa-edit').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var p = presets.find(function (x) { return x.id === b.dataset.pid; }); if (p) showEditModal(p); });
    });
    tb.querySelectorAll('.trr-pa-del').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var p = presets.find(function (x) { return x.id === b.dataset.pid; }); if (p) showDeleteModal(p); });
    });

    tb.querySelector('#trr-save-current').addEventListener('click', showSaveModal);
    tb.querySelector('#trr-compact-toggle').addEventListener('change', function (e) { settings.compactView = e.target.checked; applyCompactView(); saveSettings(); });
    tb.querySelector('#trr-dim-toggle').addEventListener('change', function (e) { settings.dimSold = e.target.checked; applyDimSold(); saveSettings(); });
    tb.querySelector('#trr-modal-cancel').addEventListener('click', closeModal);
    tb.querySelector('#trr-modal-save').addEventListener('click', handleSave);
    tb.querySelector('#trr-inp-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') closeModal(); });

    var selEmoji = '🔖';
    tb.querySelectorAll('.trr-emoji-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        tb.querySelectorAll('.trr-emoji-btn').forEach(function (x) { x.classList.remove('trr-es'); });
        b.classList.add('trr-es'); selEmoji = b.dataset.emoji;
      });
    });
    var firstEmoji = tb.querySelector('.trr-emoji-btn');
    if (firstEmoji) firstEmoji.classList.add('trr-es');
    tb._emoji = function () { return selEmoji; };
    tb._setEmoji = function (em) { selEmoji = em; tb.querySelectorAll('.trr-emoji-btn').forEach(function (b) { b.classList.toggle('trr-es', b.dataset.emoji === em); }); };

   tb.querySelector('#trr-del-cancel').addEventListener('click', closeDelModal);
 tb.querySelector('#trr-del-confirm').addEventListener('click', handleDelete);

 // Keyboard shortcuts
 document.addEventListener('keydown', function (e) {
   // Always allow Escape to close modals
   if (e.key === 'Escape') { closeModal(); closeDelModal(); return; }

   // Don't fire shortcuts when typing in an input, textarea, or contenteditable
   var tag = e.target.tagName;
   if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

   // Don't fire if a modal is open
   if (document.getElementById('trr-save-modal').style.display !== 'none') return;
   if (document.getElementById('trr-delete-modal').style.display !== 'none') return;

   // 1-9: Apply preset by number
   var num = parseInt(e.key);
   if (num >= 1 && num <= 9 && num <= presets.length) {
     e.preventDefault();
     navPreset(presets[num - 1], e.shiftKey);
     return;
   }

   // D: Toggle dim sold
   if (e.key === 'd' || e.key === 'D') {
     e.preventDefault();
     settings.dimSold = !settings.dimSold;
     applyDimSold();
     saveSettings();
     var dimToggle = document.getElementById('trr-dim-toggle');
     if (dimToggle) dimToggle.checked = settings.dimSold;
     showToast(settings.dimSold ? '👁 Dim sold on' : '👁 Dim sold off');
     return;
   }

   // C: Toggle compact view
   if (e.key === 'c' || e.key === 'C') {
     e.preventDefault();
     settings.compactView = !settings.compactView;
     applyCompactView();
     saveSettings();
     var compactToggle = document.getElementById('trr-compact-toggle');
     if (compactToggle) compactToggle.checked = settings.compactView;
     showToast(settings.compactView ? '⚡ Compact on' : '⚡ Compact off');
     return;
   }
 });
 }

  function navPreset(p, full) {
    var btn = document.querySelector('.trr-preset-btn[data-pid="' + CSS.escape(p.id) + '"]');
    if (btn) { btn.classList.add('trr-preset-active'); setTimeout(function () { btn.classList.remove('trr-preset-active'); }, 200); }
    var url;
    if (full) { url = p.fullUrl; showToast('↗ ' + p.name); }
    else if (isShopPage(location.pathname) && (p.search || p.hash)) {
      // Check if we're on a search results page (/products?keywords=...)
      // If so, preserve the keywords parameter so TRR knows what was searched
      if (location.pathname === '/products' || location.pathname.startsWith('/products/')) {
        var currentUrl = new URL(location.href);
        var keywords = currentUrl.searchParams.get('keywords');
        if (keywords) {
          var presetParams = new URLSearchParams(p.search);
          presetParams.set('keywords', keywords);
          url = location.origin + location.pathname + '?' + presetParams.toString() + (p.hash || '');
        } else {
          url = location.origin + location.pathname + (p.search || '') + (p.hash || '');
        }
      } else {
        url = location.origin + location.pathname + (p.search || '') + (p.hash || '');
      }
      showToast('✓ Applied "' + p.name + '"');
    } else { url = p.fullUrl; showToast('↗ ' + p.name); }
    setTimeout(function () { location.href = url; }, 150);
  
  }

  function showSaveModal() {
    editingPresetId = null;
    var parsed = new URL(location.href);
    var page = parsed.pathname.replace(/^\//, '').replace(/\//g, ' › ') || 'home';
    document.getElementById('trr-modal-title').textContent = 'Save Filter Preset';
    document.getElementById('trr-modal-save').textContent = 'Save Preset';
    document.getElementById('trr-filter-source').style.display = 'none';
    document.getElementById('trr-modal-context').innerHTML =
      '<div class="trr-cr"><span class="trr-cl">Page</span><span class="trr-cv">' + esc(page) + '</span></div>' +
      '<div class="trr-cr"><span class="trr-cl">Filters</span><span class="trr-cv trr-ch">' + esc(decodeFilters(parsed.search)) + '</span></div>';
    document.getElementById('trr-inp-name').value = '';
    document.getElementById('trr-inp-desc').value = '';
    document.getElementById('trr-enhancer-toolbar')._setEmoji('🔖');
    document.getElementById('trr-save-modal').style.display = 'flex';
    setTimeout(function () { document.getElementById('trr-inp-name').focus(); }, 100);
  }

  function showEditModal(p) {
    editingPresetId = p.id;
    var parsed = new URL(location.href);
    document.getElementById('trr-modal-title').textContent = 'Edit Preset';
    document.getElementById('trr-modal-save').textContent = 'Update';
    var fs = document.getElementById('trr-filter-source');
    fs.style.display = (parsed.search && parsed.search !== p.search) ? 'block' : 'none';
    document.querySelectorAll('input[name="trr-fsrc"]').forEach(function (r) { r.checked = r.value === 'keep'; });
    document.getElementById('trr-modal-context').innerHTML =
      '<div class="trr-cr"><span class="trr-cl">Saved filters</span><span class="trr-cv trr-ch">' + esc(decodeFilters(p.search)) + '</span></div>';
    document.getElementById('trr-inp-name').value = p.name || '';
    document.getElementById('trr-inp-desc').value = p.description || '';
    document.getElementById('trr-enhancer-toolbar')._setEmoji(p.emoji || '🔖');
    document.getElementById('trr-save-modal').style.display = 'flex';
    setTimeout(function () { document.getElementById('trr-inp-name').focus(); }, 100);
  }

  function closeModal() { document.getElementById('trr-save-modal').style.display = 'none'; editingPresetId = null; }

  function handleSave() {
    var name = document.getElementById('trr-inp-name').value.trim();
    if (!name) { document.getElementById('trr-inp-name').style.borderColor = '#e74c3c'; setTimeout(function () { document.getElementById('trr-inp-name').style.borderColor = ''; }, 1500); return; }
    var tb = document.getElementById('trr-enhancer-toolbar');
    var emoji = tb._emoji();
    var desc = document.getElementById('trr-inp-desc').value.trim();
    var parsed = new URL(location.href);

    if (editingPresetId) {
      var i = presets.findIndex(function (p) { return p.id === editingPresetId; });
      if (i === -1) { closeModal(); return; }
      var upd = false;
      var radio = document.querySelector('input[name="trr-fsrc"]:checked');
      if (radio) upd = radio.value === 'update';
      presets[i].name = name; presets[i].description = desc; presets[i].emoji = emoji;
      if (upd) { presets[i].fullUrl = location.href; presets[i].pathname = parsed.pathname; presets[i].search = parsed.search; presets[i].hash = parsed.hash; }
      savePresets(); closeModal(); refreshToolbar();
      showToast(upd ? '✓ Updated "' + name + '" + filters' : '✓ Updated "' + name + '"');
    } else {
      presets.push({ id: Date.now().toString(), name: name, description: desc, emoji: emoji, fullUrl: location.href, pathname: parsed.pathname, search: parsed.search, hash: parsed.hash, createdAt: new Date().toISOString() });
      savePresets(); closeModal(); refreshToolbar(); showToast('✓ Saved "' + name + '"');
    }
  }

  var pendingDelId = null;
  function showDeleteModal(p) { pendingDelId = p.id; document.getElementById('trr-del-name').textContent = '"' + p.name + '"'; document.getElementById('trr-delete-modal').style.display = 'flex'; }
  function closeDelModal() { document.getElementById('trr-delete-modal').style.display = 'none'; pendingDelId = null; }
  function handleDelete() { if (!pendingDelId) return; presets = presets.filter(function (p) { return p.id !== pendingDelId; }); savePresets(); closeDelModal(); refreshToolbar(); showToast('Deleted'); }

  function refreshToolbar() { var el = document.getElementById('trr-enhancer-toolbar'); if (el) el.remove(); createToolbar(); }

  function applyCompactView() { document.body.classList.toggle('trr-enhancer-compact', settings.compactView); }
  function applyDimSold() { document.body.classList.toggle('trr-enhancer-dim-sold', settings.dimSold); }
  function applySettings() { applyCompactView(); applyDimSold(); }

 function observeForSoldItems() {
    function scan() {
      // Strategy 1: Target TRR's specific sold label class
      document.querySelectorAll('.product-card__status-label').forEach(function (label) {
        if (/sold/i.test(label.textContent)) {
          var card = label.closest('.product-card') || label.closest('[class^="product-card"]') || label.closest('[class*="card"]');
          if (card) card.setAttribute('data-trr-sold', 'true');
        }
      });
      // Strategy 2: Fallback — check any element containing SOLD near product links
      document.querySelectorAll('a[href*="/products/"]').forEach(function (l) {
        var c = l.closest('.product-card') || l.closest('[class*="card"]') || l.parentElement;
        if (c && !c.hasAttribute('data-trr-sold') && /\bSOLD\b/i.test(c.textContent || '')) {
          c.setAttribute('data-trr-sold', 'true');
        }
      });
    }
    scan();
    var t;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 300); }).observe(document.body, { childList: true, subtree: true });
  }

  window._trrToast = function (msg) {
    document.querySelectorAll('.trr-toast').forEach(function (t) { t.remove(); });
    var t = document.createElement('div'); t.className = 'trr-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('trr-toast-visible'); });
    setTimeout(function () { t.classList.remove('trr-toast-visible'); setTimeout(function () { t.remove(); }, 300); }, 2500);
  };
  function showToast(m) { window._trrToast(m); }

  function listenForMessages() {
    chrome.runtime.onMessage.addListener(function (m) {
      if (m.type === 'RELOAD_DATA') loadData(function () { refreshToolbar(); applySettings(); });
    });
  }

  init();
})();
