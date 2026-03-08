// Google Meet 字幕抽出プラグイン v3.0

// --- セレクタ定義（Google Meet UI 変更時にここだけ更新） ---
const SELECTORS = {
  captionItem: '.nMcdL.bj4p3b',
  speaker: '.adE6rb',
  captionText: '.ygicle.VbkSUe',
  captionButton: 'button[jsname="r8qRAd"]',
  captionContainer: '[jscontroller="D1tHje"]',
  endCallButton: 'button.Iootmd.vLQezd',
};

const MEET_URL_PATTERN = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

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
  console.log('Google Meet 字幕抽出プラグイン v3.0 が起動しました');

  chrome.storage.local.get(['captionVisible', 'panelCollapsed'], (result) => {
    captionVisible = result.captionVisible !== false;
    panelCollapsed = result.panelCollapsed === true;
    createCaptionPanel();
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
function autoEnableCaptions() {
  const container = document.querySelector(SELECTORS.captionContainer);
  if (container && container.children.length === 0) {
    const btn = document.querySelector(SELECTORS.captionButton);
    if (btn && !container.classList.contains('gm-auto-clicked')) {
      container.classList.add('gm-auto-clicked');
      btn.click();
    }
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
  if (!isCaptionsSaved && currentCaption.text) {
    endCaptionLoggingAndSave();
  }
});

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

// --- フローティングパネル ---
function createCaptionPanel() {
  if (panelCreated) return;

  // 録音インジケーター用のアニメーション
  const style = document.createElement('style');
  style.textContent = `
    @keyframes gm-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'gm-caption-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 400px;
    background: rgba(34, 34, 34, 0.95);
    color: #fff;
    font-size: 14px;
    z-index: 9999;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    font-family: Arial, sans-serif;
    display: ${captionVisible ? 'block' : 'none'};
  `;

  // ヘッダー
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #555;
    cursor: pointer;
    user-select: none;
  `;

  const titleArea = document.createElement('div');
  titleArea.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const indicator = document.createElement('span');
  indicator.id = 'gm-record-indicator';
  indicator.style.cssText = `
    width: 8px; height: 8px; border-radius: 50%;
    background: #666; display: inline-block;
  `;

  const title = document.createElement('span');
  title.textContent = '字幕ログ';
  title.style.cssText = 'font-weight: bold; font-size: 13px;';

  titleArea.appendChild(indicator);
  titleArea.appendChild(title);

  const collapseBtn = document.createElement('span');
  collapseBtn.id = 'gm-collapse-btn';
  collapseBtn.textContent = panelCollapsed ? '▲' : '▼';
  collapseBtn.style.cssText = 'font-size: 12px;';

  header.appendChild(titleArea);
  header.appendChild(collapseBtn);

  header.addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    const container = document.getElementById('gm-captions-container');
    const btn = document.getElementById('gm-collapse-btn');
    if (container) container.style.display = panelCollapsed ? 'none' : 'block';
    if (btn) btn.textContent = panelCollapsed ? '▲' : '▼';
    chrome.storage.local.set({ panelCollapsed });
  });

  // 字幕コンテナ
  const captionsContainer = document.createElement('div');
  captionsContainer.id = 'gm-captions-container';
  captionsContainer.style.cssText = `
    max-height: 260px;
    overflow-y: auto;
    padding: 10px;
    user-select: text;
    display: ${panelCollapsed ? 'none' : 'block'};
  `;

  panel.appendChild(header);
  panel.appendChild(captionsContainer);
  document.body.appendChild(panel);
  panelCreated = true;
}

// --- パネルに字幕を追加 ---
function addCaptionToPanel(cap) {
  const container = document.getElementById('gm-captions-container');
  if (!container) return;

  const item = document.createElement('div');
  item.style.cssText = 'margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dotted #444;';

  const time = document.createElement('div');
  time.textContent = `[${cap.time}]`;
  time.style.cssText = 'color: #aaa; font-size: 12px; margin-bottom: 2px;';
  item.appendChild(time);

  const content = document.createElement('div');
  if (cap.speaker) {
    const speakerSpan = document.createElement('span');
    speakerSpan.textContent = cap.speaker + ': ';
    speakerSpan.style.cssText = 'font-weight: bold; color: #4285f4;';
    content.appendChild(speakerSpan);
  }
  const textSpan = document.createElement('span');
  textSpan.textContent = cap.text;
  content.appendChild(textSpan);
  item.appendChild(content);

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

// --- 録音インジケーター更新 ---
function updateRecordingIndicator(isRecording) {
  const indicator = document.getElementById('gm-record-indicator');
  if (!indicator) return;
  if (isRecording) {
    indicator.style.background = '#4caf50';
    indicator.style.animation = 'gm-pulse 1.5s infinite';
  } else {
    indicator.style.background = '#666';
    indicator.style.animation = 'none';
  }
}

// --- パネル表示切り替え ---
function updatePanelVisibility() {
  const panel = document.getElementById('gm-caption-panel');
  if (panel) panel.style.display = captionVisible ? 'block' : 'none';
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
}

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

// --- ユーティリティ ---
function formatTime() {
  const now = new Date();
  return [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

// --- 起動 ---
init();
