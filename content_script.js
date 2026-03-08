// Google Meet 字幕抽出プラグイン v3.1
// 依存: lib/config.js, lib/data-export.js, lib/ui-panel.js

// --- 状態変数 ---
let capturedCaptions = [];
let currentCaption = {};
let prevSpeakerCount = 0;
let isCaptionsSaved = true;
let panelCreated = false;
let panelCollapsed = false;
let captionVisible = true;

// --- 初期化 ---
function init() {
  console.log('Google Meet 字幕抽出プラグイン v3.1 が起動しました');

  chrome.storage.local.get(['captionVisible', 'panelCollapsed', 'pendingCaptions'], (result) => {
    captionVisible = result.captionVisible !== false;
    panelCollapsed = result.panelCollapsed === true;
    createCaptionPanel();

    // 前回未エクスポートのデータがあれば自動ダウンロード
    if (result.pendingCaptions && result.pendingCaptions.length > 0) {
      capturedCaptions = result.pendingCaptions;
      exportCaptions();
      chrome.storage.local.remove('pendingCaptions');
      capturedCaptions.forEach(cap => addCaptionToPanel(cap));
    }
  });

  setupMessageListener();
  startGlobalObserver();
}

// --- グローバル MutationObserver（200ms デバウンス） ---
let debounceTimer;

function startGlobalObserver() {
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleCaptionState, 200);
  });
  observer.observe(document, { childList: true, attributes: true, subtree: true });
}

// --- 字幕状態の処理（200ms ごとに呼ばれる） ---
function handleCaptionState() {
  autoEnableCaptions();
  monitorEndCallButton();
  monitorCaptions();
}

// --- 字幕の自動オン ---
let captionAutoEnabled = false;

function autoEnableCaptions() {
  if (captionAutoEnabled) return;
  const btn = document.querySelector(SELECTORS.captionButton);
  if (btn && CAPTION_OFF_PATTERN.test(btn.ariaLabel)) {
    btn.click();
    captionAutoEnabled = true;
  }
}

// --- 通話終了ボタンの監視 ---
function monitorEndCallButton() {
  const btn = document.querySelector(SELECTORS.endCallButton);
  if (btn && !btn.dataset.gmCaptionListener) {
    btn.addEventListener('click', () => endCaptionLoggingAndSave());
    btn.dataset.gmCaptionListener = 'true';
  }
}

// --- 字幕の監視（コア: speakers 数の変化で確定） ---
function monitorCaptions() {
  const captionItems = document.querySelectorAll(SELECTORS.captionItem);
  const speakers = document.querySelectorAll(SELECTORS.speaker);

  if (captionItems.length > 0 && speakers.length > 0) {
    isCaptionsSaved = false;

    // 最後の発言者とテキストを取得
    const speakerText = speakers[speakers.length - 1]?.textContent?.trim() || '';
    const textEl = captionItems[captionItems.length - 1]?.querySelector(SELECTORS.captionText);
    const captionText = cleanCaptionText(textEl?.textContent || '');
    if (!captionText) return;

    // 発言者数が変わった → 前の字幕を確定
    if (prevSpeakerCount > 0 && prevSpeakerCount !== speakers.length && currentCaption.text) {
      capturedCaptions.push(currentCaption);
      addCaptionToPanel(currentCaption);
      savePendingCaptions();
    }

    // 現在の字幕バッファを更新
    currentCaption = {
      time: formatTime(),
      speaker: speakerText,
      text: captionText,
    };

    prevSpeakerCount = speakers.length;
    updateRecordingIndicator(true);
  } else {
    // 字幕が消えた → 全て保存
    if (!isCaptionsSaved && currentCaption.text) {
      endCaptionLoggingAndSave();
    }
    updateRecordingIndicator(false);
  }
}

// --- 保存して終了 ---
function endCaptionLoggingAndSave() {
  if (isCaptionsSaved) return;

  if (currentCaption.text) {
    capturedCaptions.push(currentCaption);
    addCaptionToPanel(currentCaption);
  }

  exportCaptions();

  isCaptionsSaved = true;
  prevSpeakerCount = 0;
  currentCaption = {};
}

// --- タブを閉じる際の保存 ---
window.addEventListener('beforeunload', () => {
  if (!isCaptionsSaved) {
    if (currentCaption.text) {
      capturedCaptions.push(currentCaption);
    }
    // beforeunload では a.click() が不安定なため、storage に保存のみ行う
    if (capturedCaptions.length > 0) {
      savePendingCaptions();
    }
  }
});

// --- メッセージリスナー ---
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'export_captions') {
      if (currentCaption.text) {
        capturedCaptions.push({ ...currentCaption });
        addCaptionToPanel(currentCaption);
        currentCaption = {};
      }
      exportCaptions();
      sendResponse({ success: true });
    } else if (request.action === 'toggle_caption_visibility') {
      captionVisible = request.visible;
      updatePanelVisibility();
      chrome.storage.local.set({ captionVisible });
      sendResponse({ success: true });
    }
  });
}

// --- 起動 ---
init();
