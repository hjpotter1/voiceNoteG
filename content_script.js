// 字幕を保存
let capturedCaptions = [];
let lastCaptionText = ''; // 最後に捕捉した字幕を保存
let observersActive = false; // 監視が有効かどうか
let panelCreated = false; // パネルが作成されたかどうか
let captionVisible = true; // 字幕表示の状態

// メイン初期化関数
function init() {
  console.log('Google Meet 字幕抽出プラグイン v2.0 が起動しました');

  // 表示状態を取得
  chrome.storage.local.get(['captionVisible'], (result) => {
    captionVisible = result.captionVisible !== false; // デフォルトは表示

    // パネルを作成
    createCaptionPanel();

    // 表示状態を適用
    updatePanelVisibility();
  });

  // メッセージリスナーを設定
  setupMessageListener();

  // カスタムイベントを監視
  listenToCustomEvents();
}

// 会議が開始されるまで待機
function waitForMeetingToStart() {
  console.log('会議の開始を待機しています...');

  // 会議が開始されたかどうかを確認するための要素
  const checkInterval = setInterval(() => {
    // 会議が開始されたことを示す要素を探す
    const meetingStartedElements = [
      document.querySelector('.zWfAib'), // 参加者リストボタン
      document.querySelector('.NzPR9b'), // チャットボタン
      document.querySelector('.AGbzme') // 会議コントロールバー
    ];

    // いずれかの要素が存在すれば会議が開始されたと判断
    if (meetingStartedElements.some(el => el !== null)) {
      console.log('会議が開始されました。プラグイン機能を初期化します。');
      clearInterval(checkInterval);

      // 少し遅延させてから初期化（会議UIが完全に読み込まれるのを待つ）
      setTimeout(() => {
        initializePluginFeatures();
      }, 3000);
    }
  }, 2000); // 2秒ごとに確認
}

// プラグイン機能を初期化
function initializePluginFeatures() {
  // フローティングウィンドウを作成
  createCaptionPanel();

  // メッセージリスナーを設定
  setupMessageListener();

  // 字幕の検出を開始（軽量版）
  startLightweightCaptionDetection();
}

// 字幕表示パネルを作成
function createCaptionPanel() {
  // 既に作成済みの場合は何もしない
  if (panelCreated) return;

  const panel = document.createElement('div');
  panel.id = 'gm-caption-panel';

  // スタイル設定
  panel.style = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    width: 400px;
    max-height: 300px;
    overflow-y: auto;
    background: rgba(34, 34, 34, 0.9);
    color: #fff;
    font-size: 14px;
    padding: 10px;
    z-index: 9999;
    border-radius: 8px;
    box-shadow: 0 0 8px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
  `;

  document.body.appendChild(panel);
  panelCreated = true;
  console.log('字幕パネルを作成しました');

  // タイトルを追加
  const title = document.createElement('div');
  title.textContent = 'Google Meet 字幕';
  title.style = `
    font-weight: bold;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #555;
  `;
  panel.appendChild(title);

  return panel;
}

// パネルの表示状態を更新
function updatePanelVisibility() {
  const panel = document.getElementById('gm-caption-panel');
  if (panel) {
    panel.style.display = captionVisible ? 'block' : 'none';
    console.log('字幕パネルの表示状態を更新:', captionVisible ? '表示' : '非表示');
  }
}

// カスタムイベントを監視
function listenToCustomEvents() {
  console.log('カスタムイベントの監視を開始します');

  // mxcc-transcript イベントを監視
  document.addEventListener('mxcc-transcript', (event) => {
    console.log('字幕イベントを検出しました:', event.detail);

    if (event.detail && event.detail.text) {
      addCaption(event.detail.text);
    }
  });

  // バックアップとして通常の字幕検出も開始
  setTimeout(() => {
    startLightweightCaptionDetection();
  }, 5000);
}

// 軽量版の字幕検出を開始
function startLightweightCaptionDetection() {
  if (observersActive) return; // 既に監視中なら何もしない

  observersActive = true;
  console.log('軽量版の字幕検出を開始します');

  // 一般的な字幕コンテナのセレクタ
  const captionSelectors = [
    'div[role="region"][aria-label="字幕"]',
    'div[role="region"][aria-label="Captions"]',
    'div[role="region"][aria-label="Subtitles"]',
    'div[role="region"][aria-label="Caption"]',
    'div[role="region"][aria-label="Live Caption"]',
    '.a4cQT',
    '.CNusmb'
  ];

  // 定期的に字幕要素を確認
  const checkCaptionsInterval = setInterval(() => {
    let captionContainer = null;

    // セレクタを試す
    for (const selector of captionSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        captionContainer = container;
        break;
      }
    }

    // 字幕コンテナが見つかった場合
    if (captionContainer) {
      console.log('字幕コンテナを検出しました:', captionContainer);
      clearInterval(checkCaptionsInterval);

      // 監視を開始
      observeCaptionsLightweight(captionContainer);
    }
  }, 3000); // 3秒ごとに確認

  // 5分後に自動的に監視を停止（リソース節約のため）
  setTimeout(() => {
    clearInterval(checkCaptionsInterval);
  }, 5 * 60 * 1000);
}

// 軽量版の字幕監視
function observeCaptionsLightweight(container) {
  console.log('字幕コンテナの監視を開始します');

  // 字幕テキストを定期的に確認
  const checkTextInterval = setInterval(() => {
    if (container && container.textContent) {
      const text = container.textContent.trim();
      if (text && text.length > 0 && text !== lastCaptionText) {
        addCaption(text);
      }
    }
  }, 1000); // 1秒ごとに確認

  // バックアップとしてMutationObserverも使用
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const text = container.textContent.trim();
        if (text && text.length > 0 && text !== lastCaptionText) {
          addCaption(text);
        }
      }
    }
  });

  // 監視を開始（軽量設定）
  observer.observe(container, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

// 字幕をパネルと保存領域に追加
function addCaption(text) {
  // パネルが存在しない場合は作成
  if (!panelCreated) {
    createCaptionPanel();
    updatePanelVisibility();
  }

  // 重複チェック
  if (text === lastCaptionText) {
    return;
  }

  lastCaptionText = text;
  const timestamp = new Date().toLocaleTimeString();
  const captionText = `[${timestamp}] ${text}`;

  console.log('新しい字幕を捕捉:', captionText.substring(0, 50) + (captionText.length > 50 ? '...' : ''));

  // 保存領域に追加
  capturedCaptions.push(captionText);

  // パネルを取得
  const panel = document.getElementById('gm-caption-panel');
  if (!panel) {
    console.error('字幕パネルが見つかりません');
    return;
  }

  // 新しい字幕行を作成
  const captionLine = document.createElement('div');
  captionLine.textContent = captionText;
  captionLine.style.marginBottom = '8px';
  captionLine.style.whiteSpace = 'pre-wrap';
  captionLine.style.borderBottom = '1px dotted #444';
  captionLine.style.paddingBottom = '5px';

  // パネルに追加
  panel.appendChild(captionLine);

  // 自動的に下部にスクロール
  panel.scrollTop = panel.scrollHeight;
}

// 字幕をテキストファイルとしてエクスポート
function exportCaptions() {
  if (capturedCaptions.length === 0) {
    alert('まだ字幕が捕捉されていません');
    return;
  }

  const content = capturedCaptions.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Google_Meet_Captions_${Date.now()}.txt`;
  a.click();

  // クリーンアップ
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// メッセージリスナーを設定
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'export_captions') {
      exportCaptions();
      sendResponse({ success: true });
    }
    else if (request.action === 'toggle_caption_visibility') {
      captionVisible = request.visible;
      updatePanelVisibility();
      sendResponse({ success: true });

      // 状態を保存
      chrome.storage.local.set({ captionVisible: captionVisible });
    }
  });
}

// プラグインを起動
init();
