// 字幕を保存
let capturedCaptions = [];
let lastCaptionText = ''; // 最後に捕捉した字幕を保存
let observersActive = false; // 監視が有効かどうか
let panelCreated = false; // パネルが作成されたかどうか
let captionVisible = true; // 字幕表示の状態
let lastSpeaker = ''; // 最後の発言者
let currentSentence = ''; // 現在の文章
let lastTimestamp = ''; // 最後のタイムスタンプ
let captionElements = {}; // 字幕要素を保存するオブジェクト

// メイン初期化関数
function init() {
  console.log('Google Meet 字幕抽出プラグイン v2.2 が起動しました');

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

  // 字幕コンテナを追加
  const captionsContainer = document.createElement('div');
  captionsContainer.id = 'gm-captions-container';
  panel.appendChild(captionsContainer);

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
      // 発言者情報を抽出（可能であれば）
      let speaker = '';
      if (event.detail.deviceId) {
        speaker = event.detail.deviceId.split('/').pop();
      }

      // メッセージIDがあれば、それを使用して更新か新規かを判断
      const messageId = event.detail.messageId || '';
      const text = cleanCaptionText(event.detail.text);

      processCaption(text, speaker, messageId);
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
    'div[role="region"][aria-label="字幕"]'
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

  // 前回の内容を記録
  let previousText = '';
  let sentenceEndDetected = false;
  let silenceTimer = null;

  // 字幕テキストを定期的に確認
  const checkTextInterval = setInterval(() => {
    if (container && container.textContent) {
      const text = cleanCaptionText(container.textContent.trim());

      // 内容が変わった場合のみ処理
      if (text && text.length > 0 && text !== previousText) {
        // 発言者情報を取得（可能であれば）
        let speaker = '';
        const speakerEl = container.querySelector('.zs7s8d');
        if (speakerEl) {
          speaker = speakerEl.textContent.trim();
        }

        // 前回の内容と比較して、文章が完了したかどうかを判断
        if (isSentenceComplete(previousText, text)) {
          sentenceEndDetected = true;
          processCaption(previousText, speaker, '', true);

          // 少し待ってから新しい文章を処理
          setTimeout(() => {
            processCaption(text, speaker, '', false);
            sentenceEndDetected = false;
          }, 100);
        } else {
          // 文章が続いている場合
          if (!sentenceEndDetected) {
            processCaption(text, speaker, '', false);
          }
        }

        previousText = text;

        // 無音検出タイマーをリセット
        if (silenceTimer) {
          clearTimeout(silenceTimer);
        }

        // 2秒間変化がなければ文章が完了したと見なす
        silenceTimer = setTimeout(() => {
          if (text && !sentenceEndDetected) {
            processCaption(text, speaker, '', true);
            sentenceEndDetected = true;
          }
        }, 2000);
      }
    }
  }, 500); // 0.5秒ごとに確認

  // バックアップとしてMutationObserverも使用
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        // MutationObserverは頻繁に発火するので、タイマーベースの処理に任せる
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

// 文章が完了したかどうかを判断
function isSentenceComplete(prevText, currentText) {
  // 前の文章がない場合
  if (!prevText) return false;

  // 長さが短くなった場合（新しい文章が始まった可能性）
  if (currentText.length < prevText.length) return true;

  // 句読点で終わる場合
  if (prevText.match(/[。．.?？!！]$/)) return true;

  // 前の文章が現在の文章に含まれていない場合（完全に異なる文章）
  if (!currentText.includes(prevText)) return true;

  return false;
}

// 字幕テキストをクリーニング
function cleanCaptionText(text) {
  if (!text) return '';

  // 特殊な記号や不要なテキストを削除
  return text
    .replace(/arrow_downward/g, '')
    .replace(/arrow_forward/g, '')
    .replace(/一番下に移動/g, '')
    .replace(/一番下/g, '')
    .replace(/一番下に/g, '')
    .replace(/移動/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 字幕を処理
function processCaption(text, speaker, messageId = '', isFinal = false) {
  // パネルが存在しない場合は作成
  if (!panelCreated) {
    createCaptionPanel();
    updatePanelVisibility();
  }

  // テキストをクリーニング
  text = cleanCaptionText(text);
  if (!text) return;

  const timestamp = new Date().toLocaleTimeString();
  const captionId = messageId || `caption-${Date.now()}`;

  // 発言者情報を整形
  let speakerInfo = '';
  if (speaker) {
    speakerInfo = speaker;

    // 発言者が変わった場合は新しい発言として扱う
    if (lastSpeaker && lastSpeaker !== speaker) {
      isFinal = true;
    }

    lastSpeaker = speaker;
  }

  // 既存の要素を更新するか、新しい要素を作成するか
  if (captionElements[captionId] && !isFinal) {
    // 既存の要素を更新
    updateCaptionElement(captionId, text, timestamp);
  } else {
    // 新しい要素を作成
    if (isFinal && currentSentence) {
      // 最終的な文章を保存
      saveFinalCaption(currentSentence, speakerInfo, lastTimestamp || timestamp);
      currentSentence = '';
    }

    // 新しい文章を開始
    createCaptionElement(captionId, text, speakerInfo, timestamp);
    currentSentence = text;
    lastTimestamp = timestamp;
  }
}

// 字幕要素を更新
function updateCaptionElement(id, text, timestamp) {
  const element = captionElements[id];
  if (!element) return;

  // テキスト部分を更新
  const textElement = element.querySelector('.gm-caption-text');
  if (textElement) {
    textElement.textContent = text;
    currentSentence = text;
  }
}

// 新しい字幕要素を作成
function createCaptionElement(id, text, speaker, timestamp) {
  // コンテナを取得
  const container = document.getElementById('gm-captions-container');
  if (!container) {
    console.error('字幕コンテナが見つかりません');
    return;
  }

  // 新しい字幕要素を作成
  const captionElement = document.createElement('div');
  captionElement.className = 'gm-caption-item';
  captionElement.dataset.id = id;
  captionElement.style = `
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dotted #444;
  `;

  // タイムスタンプ要素
  const timestampElement = document.createElement('div');
  timestampElement.className = 'gm-caption-timestamp';
  timestampElement.textContent = `[${timestamp}]`;
  timestampElement.style = `
    color: #aaa;
    font-size: 12px;
    margin-bottom: 3px;
  `;
  captionElement.appendChild(timestampElement);

  // 発言者要素（存在する場合）
  if (speaker) {
    const speakerElement = document.createElement('span');
    speakerElement.className = 'gm-caption-speaker';
    speakerElement.textContent = speaker + ': ';
    speakerElement.style = `
      font-weight: bold;
      color: #4285f4;
    `;

    // テキスト要素
    const textElement = document.createElement('span');
    textElement.className = 'gm-caption-text';
    textElement.textContent = text;

    // 内容要素
    const contentElement = document.createElement('div');
    contentElement.className = 'gm-caption-content';
    contentElement.appendChild(speakerElement);
    contentElement.appendChild(textElement);

    captionElement.appendChild(contentElement);
  } else {
    // 発言者がない場合は直接テキストを追加
    const textElement = document.createElement('div');
    textElement.className = 'gm-caption-text';
    textElement.textContent = text;
    captionElement.appendChild(textElement);
  }

  // コンテナに追加
  container.appendChild(captionElement);

  // 要素を保存
  captionElements[id] = captionElement;

  // 自動的に下部にスクロール
  const panel = document.getElementById('gm-caption-panel');
  if (panel) {
    panel.scrollTop = panel.scrollHeight;
  }
}

// 最終的な字幕を保存
function saveFinalCaption(text, speaker, timestamp) {
  // 保存用のテキスト
  const captionText = `[${timestamp}] ${speaker ? speaker + ': ' : ''}${text}`;

  // 保存領域に追加
  capturedCaptions.push(captionText);
  console.log('字幕を保存しました:', captionText);
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
      // 現在処理中の文章があれば、それも保存
      if (currentSentence) {
        saveFinalCaption(currentSentence, lastSpeaker, lastTimestamp || new Date().toLocaleTimeString());
      }

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
