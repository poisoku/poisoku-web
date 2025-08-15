# ポイントインカム スクレイピングシステム

## 📋 システム概要

ポイントインカムの案件データを自動取得するスクレイピングシステム群です。

## 🚀 現在の運用システム

### 1. スマホアプリ案件スクレイパー（最適化版）
- **ファイル**: `PointIncomeAppScraper.js`
- **エントリーポイント**: `main_pointincome_app.js`
- **特徴**:
  - iOS環境のみで全案件取得（実行時間50%短縮）
  - タイトルベースの自動デバイス分類
  - AJAX手法による完全データ取得
  - 実行時間: 約4分
  - 取得件数: 約340件 → 370件（iOS/Android別出力）

**実行方法**:
```bash
node main_pointincome_app.js
```

### 2. Web案件スクレイパー
- **ファイル**: `PointIncomeWebScraperFinal.js`
- **対象**: Web案件（82カテゴリ）
- **特徴**: 確実に1ページ目取得 + 可能な範囲で複数ページ対応

**実行方法**:
```bash
node PointIncomeWebScraperFinal.js
```

### 3. PC限定案件スクレイパー
- **ファイル**: `PointIncomePCOnlyScraper.js`
- **対象**: PC限定案件（ブラウザゲーム等）
- **特徴**: カテゴリ270専用・AJAX対応

**実行方法**:
```bash
node PointIncomePCOnlyScraper.js
```

## 📁 ディレクトリ構成

```
/pointincome/
├── README.md                           # このファイル
├── PointIncomeAppScraper.js           # スマホアプリ案件スクレイパー（メイン）
├── PointIncomeOptimizedAppScraper.js  # 最適化版オリジナル
├── PointIncomeWebScraperFinal.js      # Web案件スクレイパー
├── PointIncomePCOnlyScraper.js        # PC限定案件スクレイパー
├── main_pointincome_app.js            # アプリ案件エントリーポイント
├── PointIncomeScrapingConfig.js       # 設定管理
├── PointIncomeRetryManager.js         # リトライ機能
└── archive/                            # アーカイブディレクトリ
    ├── deprecated_20250812/            # 廃止された旧システム
    └── investigation_files/            # 調査・テスト用ファイル
```

## 🔄 更新履歴

- **2025-08-12**: スマホアプリ案件スクレイパーを最適化版に更新
  - 実行時間を50%短縮（約7.5分→約4分）
  - iOS環境のみで全案件取得
  - タイトルベースのデバイス分類機能追加
  - 旧システムをアーカイブに移動

## 📊 出力データ形式

### スマホアプリ案件
```json
{
  "id": "campaign_id",
  "title": "アプリ名",
  "url": "https://sp.pointi.jp/...",
  "points": "100pt",
  "category": "ゲーム",
  "device": "iOS",
  "deviceClassification": "ios_only",
  "scrapedAt": "2025-08-12T06:26:00.000Z"
}
```

### 出力ファイル
- `pointincome_ios_optimized_[timestamp].json` - iOS案件
- `pointincome_android_optimized_[timestamp].json` - Android案件
- `pointincome_optimized_combined_[timestamp].json` - 統合版
- `pointincome_raw_data_[timestamp].json` - 生データ（デバッグ用）

## ⚠️ 注意事項

- 過度なアクセスを避けるため、実行間隔を適切に設定してください
- スクレイピング実行時はネットワーク環境を確認してください
- データ取得後は必ず件数と内容を確認してください