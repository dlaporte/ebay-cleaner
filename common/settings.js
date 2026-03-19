const EBF_DEFAULTS = {
  minFeedbackCount: 1,
  minPositivePercent: 90,
  filterFeedbackCount: true,
  filterPositivePercent: true,
  filterClassifieds: true,
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
