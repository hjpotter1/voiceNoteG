// --- セレクタ定義（Google Meet UI 変更時にここだけ更新） ---
const SELECTORS = {
  captionItem: '.nMcdL.bj4p3b',
  speaker: '.adE6rb',
  captionText: '.ygicle.VbkSUe',
  captionButton: 'button[jsname="RrG0hf"]',
  endCallButton: 'button.Iootmd.vLQezd',
};

const MEET_URL_PATTERN = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

// 字幕ボタンが「オフ状態」であることを示す ariaLabel パターン（多言語対応）
// ボタンのラベルは「クリックするとオンになる」= 現在オフ、を意味する
const CAPTION_OFF_PATTERN = /字幕をオンにする|Turn on captions|开启字幕|Activar subtítulos|Sous-titres activés/i;
