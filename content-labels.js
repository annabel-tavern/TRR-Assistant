// RealReal Enhancer - Item Labels (hover-to-tag, colored dots, click-safe)

(function () {
  'use strict';

  var labels = [];
  var savedItems = {};

  function init() {
    loadLabelData(function () {
      scanAndDecorate();
      observeNewCards();
    });
  }

  function loadLabelData(callback) {
    chrome.storage.sync.get(['labels'], function (syncData) {
      labels = (syncData && syncData.labels) || [
        { id: 'want-to-buy', name: 'Want to Buy', emoji: '🛒', color: '#27ae60' },
        { id: 'reference', name: 'Reference', emoji: '📌', color: '#3498db' },
        { id: 'gift', name: 'For a Gift', emoji: '🎁', color: '#e74c3c' }
      ];
      chrome.storage.local.get(['savedItems'], function (localData) {
        savedItems = (localData && localData.savedItems) || {};
        if (callback) callback();
      });
    });
  }

  function saveLabelData() { chrome.storage.local.set({ savedItems: savedItems }); }

  function getProductKey(url) {
    try { return new URL(url, location.origin).pathname; }
    catch (e) { return null; }
  }

  function extractItemData(card, link) {
    var img = card.querySelector('img');
    var allText = card.innerText || card.textContent || '';
    var lines = allText.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var brand = '', title = '', price = '';
    for (var i = 0; i < lines.length; i++) {
      if (/^\$[\d,]+/.test(lines[i]) || /^[\d,]+\s*$/.test(lines[i])) { if (!price) price = lines[i]; }
      else if (!brand) brand = lines[i];
      else if (!title) title = lines[i];
    }
    return { url: link.href, title: title || brand || 'Unknown Item', brand: brand || '', price: price || '', imageUrl: img ? img.src : '' };
  }

  function scanAndDecorate() {
    var links = document.querySelectorAll('a[href*="/products/"]');
    var seen = new Set();
    links.forEach(function (link) {
      var card = link.closest('[class*="card"],[class*="Card"],[class*="product"],[class*="Product"],[class*="item"],[class*="Item"],[data-testid]') || link.parentElement;
      if (!card || seen.has(card) || card.hasAttribute('data-trr-labeled')) return;
      seen.add(card);
      card.setAttribute('data-trr-labeled', 'true');
      var key = getProductKey(link.href);
      if (!key) return;
      renderDots(card, key);
      addHoverPanel(card, link, key);
    });
  }

  function renderDots(card, key) {
    card.querySelectorAll('.trr-label-dots').forEach(function (d) { d.remove(); });
    var item = savedItems[key];
    if (!item || !item.labels || item.labels.length === 0) return;
    var c = document.createElement('div');
    c.className = 'trr-label-dots';
    item.labels.forEach(function (labelId) {
      var label = labels.find(function (l) { return l.id === labelId; });
      if (!label) return;
      var dot = document.createElement('span');
      dot.className = 'trr-label-dot';
      dot.style.background = label.color;
      dot.title = label.name;
      c.appendChild(dot);
    });
    card.appendChild(c);
  }

  function addHoverPanel(card, link, key) {
    var panel = document.createElement('div');
    panel.className = 'trr-label-panel';

    function renderPanel() {
      var item = savedItems[key];
      var activeLabels = item ? (item.labels || []) : [];
      panel.innerHTML = labels.map(function (l) {
        var isActive = activeLabels.indexOf(l.id) !== -1;
        return '<button class="trr-label-tag' + (isActive ? ' trr-lt-active' : '') + '" data-label-id="' + l.id + '" style="--label-color: ' + l.color + '" title="' + (isActive ? 'Remove' : 'Add') + ': ' + l.name + '">' + l.emoji + '</button>';
      }).join('');
      panel.querySelectorAll('.trr-label-tag').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          toggleLabel(card, link, key, btn.dataset.labelId);
          renderPanel();
        });
      });
    }
    renderPanel();
    card.appendChild(panel);
  }

  function toggleLabel(card, link, key, labelId) {
    if (!savedItems[key]) {
      var data = extractItemData(card, link);
      savedItems[key] = { url: data.url, title: data.title, brand: data.brand, price: data.price, imageUrl: data.imageUrl, key: key, labels: [], savedAt: new Date().toISOString() };
    }
    var item = savedItems[key];
    var idx = item.labels.indexOf(labelId);
    var label = labels.find(function (l) { return l.id === labelId; });

    if (idx >= 0) {
      item.labels.splice(idx, 1);
      if (item.labels.length === 0) {
        delete savedItems[key];
        if (window._trrToast) window._trrToast('Removed label');
      } else {
        if (window._trrToast) window._trrToast('Removed "' + (label ? label.name : '') + '"');
      }
    } else {
      item.labels.push(labelId);
      if (window._trrToast) window._trrToast((label ? label.emoji + ' ' + label.name : 'Labeled'));
    }
    saveLabelData();
    renderDots(card, key);
  }

  function observeNewCards() {
    var t;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scanAndDecorate, 400); }).observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === 'RELOAD_DATA') {
      loadLabelData(function () {
        document.querySelectorAll('[data-trr-labeled]').forEach(function (card) {
          var link = card.querySelector('a[href*="/products/"]');
          if (!link) return;
          var key = getProductKey(link.href);
          if (key) renderDots(card, key);
        });
      });
    }
  });

  init();
})();
