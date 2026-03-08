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
