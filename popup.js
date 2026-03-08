// ポップアップウィンドウが読み込まれたとき
document.addEventListener('DOMContentLoaded', () => {
  // 字幕表示切り替えボタン
  const toggleBtn = document.getElementById('toggleBtn');

  // エクスポートボタン
  const exportBtn = document.getElementById('exportBtn');

  // 現在の表示状態を取得
  chrome.storage.local.get(['captionVisible'], (result) => {
    const isVisible = result.captionVisible !== false; // デフォルトは表示
    updateToggleButtonText(toggleBtn, isVisible);
  });

  // 字幕表示切り替えボタンのクリックイベント
  toggleBtn.addEventListener('click', () => {
    chrome.storage.local.get(['captionVisible'], (result) => {
      const currentlyVisible = result.captionVisible !== false;
      const newState = !currentlyVisible;

      // 状態を保存
      chrome.storage.local.set({ captionVisible: newState });

      // ボタンテキストを更新
      updateToggleButtonText(toggleBtn, newState);

      // コンテンツスクリプトに通知
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'toggle_caption_visibility', visible: newState },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('送信失敗:', chrome.runtime.lastError.message);
              return;
            }
            console.log('表示状態を変更:', newState, response);
          }
        );
      });
    });
  });

  // エクスポートボタンのクリックイベント
  exportBtn.addEventListener('click', () => {
    // コンテンツスクリプトにエクスポート指示を送信
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'export_captions' },
        (response) => {
          if (chrome.runtime.lastError) {
            exportBtn.textContent = 'Meet画面を開いてください';
            setTimeout(() => {
              exportBtn.textContent = '字幕を手動エクスポート';
            }, 2000);
            return;
          }
          if (response && response.success) {
            exportBtn.textContent = 'エクスポート成功!';
            setTimeout(() => {
              exportBtn.textContent = '字幕を手動エクスポート';
            }, 1500);
          }
        }
      );
    });
  });
});

// トグルボタンのテキストを更新
function updateToggleButtonText(button, isVisible) {
  button.textContent = isVisible ? '字幕表示をオフにする' : '字幕表示をオンにする';
}
