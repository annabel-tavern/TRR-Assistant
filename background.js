// RealReal Enhancer - Background Service Worker

var DEFAULT_LABELS = [
  { id: 'want-to-buy', name: 'Want to Buy', emoji: '🛒', color: '#27ae60' },
  { id: 'reference', name: 'Reference', emoji: '📌', color: '#3498db' },
  { id: 'gift', name: 'For a Gift', emoji: '🎁', color: '#e74c3c' }
];

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(['presets', 'settings', 'labels'], function (data) {
    if (!data.presets) chrome.storage.sync.set({ presets: [] });
    if (!data.labels) chrome.storage.sync.set({ labels: DEFAULT_LABELS });
    if (!data.settings) chrome.storage.sync.set({ settings: { compactView: false, dimSold: true, toolbarCollapsed: false } });
  });
  chrome.storage.local.get(['savedItems'], function (data) {
    if (!data.savedItems) chrome.storage.local.set({ savedItems: {} });
  });
});

chrome.runtime.onMessage.addListener(function (message) {
  if (message.type === 'REFRESH_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'RELOAD_DATA' });
    });
  }
});
