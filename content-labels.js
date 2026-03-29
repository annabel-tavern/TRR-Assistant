// ============================================================
// RealReal Enhancer - Item Labels (v1.3.1 — click fix)
// Hover-to-tag labels on product cards. Labels NEVER block
// clicks on the underlying product card/link.
// ============================================================

(function () {
  'use strict';

  let labels = [];
  let savedItems = {};

  async function init() {
    await loadLabelData();
    scanAndDecorate();
    observeNewCards();
  }

  // ── Storage ────────────────────────────────────────────────
  async function loadLabelData() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['labels'], (syncData) => {
        labels = syncData.labels || [
          { id: 'want-to-buy', name: 'Want to Buy', emoji: '🛒', color: '#27ae60' },
          { id: 'reference', name: 'Reference', emoji: '📌', color: '#3498db' },
          { id: 'gift', name: 'For a Gift', emoji: '🎁', color: '#e74c3c' },
        ];
        chrome.storage.local.get(['savedItems'], (localData) => {
          savedItems = localData.savedItems || {};
          resolve();
        });
      });
    });
  }

  async function saveLabelData() {
    await chrome.storage.local.set({ savedItems });
  }

  function getProductKey(url) {
    try { return new URL(url, location.origin).pathname; }
    catch { return null; }
  }

  function extractItemData(card, link) {
    const img = card.querySelector('img');
    const allText = card.innerText || card.textContent || '';
    const lines = allText.split('\n').map((l) => l.trim()).filter(Boolean);
    let brand = '', title = '', price = '';
    for (const line of lines) {
      if (/^\$[\d,]+/.test(line) || /^[\d,]+\s*$/.test(line)) { if (!price) price = line; }
      else if (!brand) brand = line;
      else if (!title) title = line;
    }
    return {
      url: link.href,
      title: title || brand || 'Unknown Item',
      brand: brand || '',
      price: price || '',
      imageUrl: img ? img.src : '',
    };
  }

  // ── Scan product cards and add overlays ────────────────────
  function scanAndDecorate() {
    const links = document.querySelectorAll('a[href*="/products/"]');
    const seen = new Set();

    links.forEach((link) => {
      const card = link.closest(
        '[class*="card"],[class*="Card"],[class*="product"],[class*="Product"],[class*="item"],[class*="Item"],[data-testid]'
      ) || link.parentElement;

      if (!card || seen.has(card) || card.hasAttribute('data-trr-labeled')) return;
      seen.add(card);
      card.setAttribute('data-trr-labeled', 'true');

      // *** KEY FIX: Do NOT change card's position property ***
      // Changing position can break TRR's layout and click handling.
      // Instead, we use pointer-events carefully so overlays never
      // block clicks on the card itself.

      const key = getProductKey(link.href);
      if (!key) return;

      renderDots(card, key);
      addHoverPanel(card, link, key);
    });
  }

  // ── Colored Dot Indicators ─────────────────────────────────
  function renderDots(card, key) {
    card.querySelectorAll('.trr-label-dots').forEach((d) => d.remove());
    const item = savedItems[key];
    if (!item || !item.labels || item.labels.length === 0) return;

    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'trr-label-dots';
    // pointer-events: none is set in CSS — dots never block clicks

    item.labels.forEach((labelId) => {
      const label = labels.find((l) => l.id === labelId);
      if (!label) return;
      const dot = document.createElement('span');
      dot.className = 'trr-label-dot';
      dot.style.background = label.color;
      dot.title = label.name;
      dotsContainer.appendChild(dot);
    });

    card.appendChild(dotsContainer);
  }

  // ── Hover Label Panel ──────────────────────────────────────
  function addHoverPanel(card, link, key) {
    const panel = document.createElement('div');
    panel.className = 'trr-label-panel';
    // The panel itself is ALWAYS pointer-events: none (set in CSS).
    // Only the individual emoji buttons inside have pointer-events: auto.
    // This means clicks pass straight through to the card/link
    // unless you click directly on an emoji button.

    function renderPanel() {
      const item = savedItems[key];
      const activeLabels = item ? (item.labels || []) : [];

      panel.innerHTML = labels.map((l) => {
        const isActive = activeLabels.includes(l.id);
        return `<button class="trr-label-tag${isActive ? ' trr-lt-active' : ''}"
                  data-label-id="${l.id}" style="--label-color: ${l.color}"
                  title="${isActive ? 'Remove' : 'Add'}: ${l.name}">
                  ${l.emoji}
                </button>`;
      }).join('');

      panel.querySelectorAll('.trr-label-tag').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleLabel(card, link, key, btn.dataset.labelId);
          renderPanel();
        });
      });
    }

    renderPanel();
    card.appendChild(panel);
  }

  // ── Toggle a label ─────────────────────────────────────────
  async function toggleLabel(card, link, key, labelId) {
    if (!savedItems[key]) {
      const data = extractItemData(card, link);
      savedItems[key] = { ...data, key, labels: [], savedAt: new Date().toISOString() };
    }

    const item = savedItems[key];
    const idx = item.labels.indexOf(labelId);
    const label = labels.find((l) => l.id === labelId);

    if (idx >= 0) {
      item.labels.splice(idx, 1);
      if (item.labels.length === 0) {
        delete savedItems[key];
        if (window._trrToast) window._trrToast('Removed label');
      } else {
        if (window._trrToast) window._trrToast(`Removed "${label?.name}"`);
      }
    } else {
      item.labels.push(labelId);
      if (window._trrToast) window._trrToast(`${label?.emoji} ${label?.name}`);
    }

    await saveLabelData();
    renderDots(card, key);
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTENT' }).catch(() => {});
  }

  // ── Watch for new cards ────────────────────────────────────
  function observeNewCards() {
    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(scanAndDecorate, 400);
    }).observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'RELOAD_DATA') {
      loadLabelData().then(() => {
        document.querySelectorAll('[data-trr-labeled]').forEach((card) => {
          const link = card.querySelector('a[href*="/products/"]');
          if (!link) return;
          const key = getProductKey(link.href);
          if (key) renderDots(card, key);
        });
      });
    }
  });

  window._trrLabels = { labels, savedItems, loadLabelData, saveLabelData };
  init();
})();
