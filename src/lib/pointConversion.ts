// ポイントサイトごとの円換算レート設定
export const POINT_CONVERSION_RATES: Record<string, number> = {
  'ちょびリッチ': 0.5,      // 2ポイント = 1円
  'ハピタス': 1,            // 1ポイント = 1円
  'モッピー': 1,            // 1ポイント = 1円
  'ポイントインカム': 0.1,  // 10ポイント = 1円
  'ポイントタウン': 0.05,   // 20ポイント = 1円
  'ECナビ': 0.1,            // 10ポイント = 1円
  'げん玉': 0.1,            // 10ポイント = 1円
  'ポイぷる': 0.1,          // 10ポイント = 1円
  'アメフリ': 0.1,          // 10ポイント = 1円
  'ワラウ': 0.1,            // 10ポイント = 1円
  'ニフティポイントクラブ': 1, // 1ポイント = 1円
  'すぐたま': 0.5,          // 2ポイント = 1円
  'GetMoney!': 0.1,         // 10ポイント = 1円
  'Gポイント': 1,           // 1ポイント = 1円
  'colleee': 0.1,           // 10ポイント = 1円
  'Unknown': 1              // デフォルト: 1ポイント = 1円
};

// キャッシュバック金額を円換算する関数
export function convertToYen(cashback: string, siteName: string): string {
  // 入力値のクリーニング
  const cleanedCashback = cashback.trim();
  
  // %表記の場合はそのまま返す
  if (cleanedCashback.includes('%') || cleanedCashback.includes('％')) {
    return cleanedCashback;
  }
  
  // 「円」が既に含まれている場合はそのまま返す
  if (cleanedCashback.includes('円')) {
    return cleanedCashback;
  }
  
  // 「要確認」などの特殊な値の場合はそのまま返す
  if (cleanedCashback === '要確認' || cleanedCashback === '-' || cleanedCashback === '') {
    return cleanedCashback;
  }
  
  // 数値とポイント/ptを抽出
  const pointMatch = cleanedCashback.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ポイント|point|pt|p)?$/i);
  
  if (!pointMatch) {
    // 数値が抽出できない場合はそのまま返す
    return cleanedCashback;
  }
  
  // カンマを除去して数値に変換
  const pointValue = parseFloat(pointMatch[1].replace(/,/g, ''));
  
  if (isNaN(pointValue)) {
    return cleanedCashback;
  }
  
  // サイト名から換算レートを取得
  const conversionRate = POINT_CONVERSION_RATES[siteName] || POINT_CONVERSION_RATES['Unknown'];
  
  // 円に換算
  const yenValue = Math.floor(pointValue * conversionRate);
  
  // 3桁区切りでフォーマット
  const formattedYen = yenValue.toLocaleString('ja-JP');
  
  return `${formattedYen}円`;
}

// キャッシュバック値から数値を抽出する関数（ソート用）
export function extractNumericValue(cashback: string): number {
  // %の場合
  const percentMatch = cashback.match(/(\d+(?:\.\d+)?)\s*[%％]/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]);
  }
  
  // 円の場合
  const yenMatch = cashback.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*円/);
  if (yenMatch) {
    return parseFloat(yenMatch[1].replace(/,/g, ''));
  }
  
  // ポイントの場合（レート換算なし、純粋な数値として）
  const pointMatch = cashback.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ポイント|point|pt|p)?$/i);
  if (pointMatch) {
    return parseFloat(pointMatch[1].replace(/,/g, ''));
  }
  
  return 0;
}

// ポイントサイトの換算レート情報を取得
export function getConversionRateInfo(siteName: string): {
  rate: number;
  description: string;
} {
  const rate = POINT_CONVERSION_RATES[siteName] || 1;
  
  if (rate === 1) {
    return {
      rate,
      description: '1ポイント = 1円'
    };
  } else if (rate === 0.5) {
    return {
      rate,
      description: '2ポイント = 1円'
    };
  } else if (rate === 0.1) {
    return {
      rate,
      description: '10ポイント = 1円'
    };
  } else if (rate === 0.05) {
    return {
      rate,
      description: '20ポイント = 1円'
    };
  }
  
  return {
    rate,
    description: `${Math.round(1 / rate)}ポイント = 1円`
  };
}