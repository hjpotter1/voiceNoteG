// --- テキストクリーニング ---
function cleanCaptionText(text) {
  if (!text) return '';
  return text
    .replace(/arrow_downward/g, '')
    .replace(/arrow_forward/g, '')
    .replace(/arrow_upward/g, '')
    .replace(/一番下に移動/g, '')
    .replace(/一番下/g, '')
    .replace(/Jump to the bottom/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- ユーティリティ ---
function formatTime() {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

// --- Storage 持久化 ---
function savePendingCaptions() {
  chrome.storage.local.set({ pendingCaptions: capturedCaptions });
}

function clearPendingCaptions() {
  chrome.storage.local.remove('pendingCaptions');
}

// --- エクスポート ---
function exportCaptions() {
  if (capturedCaptions.length === 0) return;

  const lines = capturedCaptions.map(cap =>
    `[${cap.time}] ${cap.speaker ? cap.speaker + ': ' : ''}${cap.text}`
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Google_Meet_Captions_${Date.now()}.txt`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 100);
  clearPendingCaptions();
}
