// 効果音サービス（フリー素材MP3）
// 素材提供: OtoLogic (https://otologic.jp) CC BY 4.0

let correctAudio: HTMLAudioElement | null = null;
let closeAudio: HTMLAudioElement | null = null;

// 正解音（ピンポン♪）
export function playCorrectSound(): void {
  try {
    if (!correctAudio) {
      correctAudio = new Audio('/sounds/correct.mp3');
      correctAudio.volume = 0.5;
    }
    correctAudio.currentTime = 0;
    correctAudio.play();
  } catch (e) {
    // 再生エラーは無視
  }
}

// 惜しい音（ポン♪）
export function playCloseSound(): void {
  try {
    if (!closeAudio) {
      closeAudio = new Audio('/sounds/close.mp3');
      closeAudio.volume = 0.4;
    }
    closeAudio.currentTime = 0;
    closeAudio.play();
  } catch (e) {
    // 再生エラーは無視
  }
}
