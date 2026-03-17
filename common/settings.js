const EBF_DEFAULTS = {
  minFeedbackCount: 1,
  minPositivePercent: 90,
  filterMode: 'hide',
  bannerStyle: 'sticky',
  galleryMode: 'redirect'  // 'banner' | 'redirect'
};

async function ebfGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(EBF_DEFAULTS, (settings) => {
      resolve(settings);
    });
  });
}

async function ebfSaveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}
