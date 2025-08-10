# ポイントインカム スクレイピングシステム

## 概要
ポイントインカムの全83カテゴリ（ショッピング51 + サービス32）から案件情報を自動取得するシステムです。モバイル版の無限スクロールを使用して、2ページ目以降の案件も確実に取得します。

## 主要ファイル

### 本番用（推奨）
- `PointIncomeOptimized.js` - 最適化版スクレイパー（コード量40%削減、保守性向上）

### その他のファイル
- `PointIncomeMobileComplete.js` - 初期完成版（動作実績あり）
- `PointIncomeMobileInfiniteScroll.js` - 開発版

## 実績データ
- **取得案件数**: 2,600-2,700件
- **実行時間**: 約35-40分
- **エラー率**: 2-3%（許容範囲内）
- **成功事例**: 「いぬのきもち・ねこのきもち」案件（ID: 12069）の取得に成功

## 使用方法

### 1. 単体実行
```bash
cd scrapers/src/sites/pointincome
node PointIncomeOptimized.js
```

### 2. バックグラウンド実行（推奨）
```bash
# スクリプトを使用
cd /Users/kn/poisoku-web
./scripts/run-pointincome-scraping.sh
```

### 3. 実行後の統合
```bash
# データ統合スクリプト
node scripts/integrate-pointincome-full-data.js
```

## 技術仕様

### モバイル版無限スクロール
- User-Agent: iOS Safari
- スクロール待機時間: 2.5秒
- 最大スクロール回数: 30回/カテゴリ
- ブラウザ再起動: 15カテゴリごと

### カテゴリ一覧
```javascript
// ショッピングカテゴリ（51個）
shopping: [
  66, 161, 160, 229, 244, 245, 246, 177, 179, 247, 178, 248, 249, 262, 250,
  251, 184, 185, 263, 252, 264, 265, 183, 253, 169, 166, 168, 167, 255, 256,
  261, 254, 171, 162, 163, 164, 173, 174, 175, 176, 230, 225, 195, 257, 258,
  194, 196, 193, 259, 260, 180
]

// サービスカテゴリ（32個）
service: [
  69, 70, 75, 281, 73, 74, 276, 78, 235, 79, 240, 72, 76, 81, 274, 237,
  209, 271, 232, 269, 234, 238, 280, 272, 278, 277, 283, 279, 77, 236, 270, 82
]
```

## 出力ファイル形式
```json
{
  "scrape_date": "2025-08-10T08:44:40.248Z",
  "version": "mobile_optimized_v1",
  "stats": {
    "categoriesProcessed": 83,
    "totalScrolls": 459,
    "totalPages": 377,
    "duplicatesSkipped": 734,
    "errors": [],
    "highVolumeCategories": 25
  },
  "total_campaigns": 2667,
  "campaigns": [
    {
      "id": "12069",
      "title": "いぬのきもち・ねこのきもち",
      "url": "https://pointi.jp/ad/12069/",
      "points": "180円",
      "device": "すべて",
      "category_id": 258,
      "category_type": "shopping",
      "timestamp": "2025-08-10T08:30:15.123Z"
    }
  ]
}
```

## メンテナンス

### カテゴリ追加
`PointIncomeOptimized.js`の`categories`プロパティに番号を追加するだけ：
```javascript
shopping: [66, 161, ..., 999] // 新カテゴリ999を追加
```

### エラー対処
- タイムアウトエラーは自動リトライ（2回まで）
- ブラウザ接続エラーは自動再起動で対処
- エラー率2-3%は正常範囲

## 注意事項
- 実行時は約40分かかるため、バックグラウンド実行推奨
- 定期実行の場合は間隔を空ける（サーバー負荷軽減）
- 取得データは`/scrapers/data/pointincome/`に保存される