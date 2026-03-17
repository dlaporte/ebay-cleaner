(async function () {
  var fields = ['minFeedbackCount', 'minPositivePercent', 'filterMode', 'bannerStyle'];

  // Load current settings into form
  var settings = await ebfGetSettings();
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById(fields[i]);
    if (el) el.value = settings[fields[i]];
  }

  // Save
  document.getElementById('save').addEventListener('click', async function () {
    var updated = {};
    updated.minFeedbackCount = parseInt(document.getElementById('minFeedbackCount').value, 10);
    updated.minPositivePercent = parseInt(document.getElementById('minPositivePercent').value, 10);
    updated.filterMode = document.getElementById('filterMode').value;
    updated.bannerStyle = document.getElementById('bannerStyle').value;

    // Basic validation
    if (isNaN(updated.minFeedbackCount) || updated.minFeedbackCount < 0) {
      updated.minFeedbackCount = EBF_DEFAULTS.minFeedbackCount;
    }
    if (isNaN(updated.minPositivePercent) || updated.minPositivePercent < 0 || updated.minPositivePercent > 100) {
      updated.minPositivePercent = EBF_DEFAULTS.minPositivePercent;
    }

    await ebfSaveSettings(updated);

    var status = document.getElementById('status');
    status.textContent = 'Saved! Reload eBay tabs to apply.';
    setTimeout(function () { status.textContent = ''; }, 3000);
  });
})();
