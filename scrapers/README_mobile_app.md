# ちょびリッチ スマホアプリ案件スクレイピングシステム【完成版】

## 概要
ちょびリッチのスマホアプリ案件を完全自動取得するスクレイピングシステムです。
iOS/Android別々のUser-Agentでアクセスし、OSごとに異なる案件を正確に取得します。

## システム仕様

### 📱 対応プラットフォーム
- **iOS**: iPhone User-Agent使用
- **Android**: Android User-Agent使用
- **両OS対応**: 並行処理による効率的な取得

### 📊 取得能力
- **対応ページ数**: 20ページ（自動検出・終了）
- **総案件数**: 約577-578件（iOS + Android合計）
- **ポイント範囲**: 1pt ～ 70,000pt以上
- **実行時間**: 約15-25分（両OS取得時）

### 🎯 主要機能
1. **正確なポイント抽出**
   - 1-5桁のポイント値対応
   - カンマ区切り形式対応（12,720pt）
   - 連続数字形式対応（12720pt）
   - 矢印表記対応（1000pt→2000pt = 2000pt取得）

2. **精密なタイトル取得**
   - HTML strong要素の太字部分のみ抽出
   - 余分な説明文・ポイント数を自動除外
   - 完全なアプリ名を保持

3. **OSごとの案件差異対応**
   - iOS専用案件の取得
   - Android専用案件の取得
   - 同一アプリでもOS別ID管理

4. **エラー耐性・レート制限対応**
   - 3秒間隔でのページ間待機
   - HTTPエラー・タイムアウト対応
   - 詳細なエラーログ記録

## ファイル構成

```
scrapers/
├── main_mobile_app.js                    # メインエントリーポイント
├── src/sites/chobirich/
│   └── MobileAppScraper.js              # コアスクレイピングロジック
├── README_mobile_app.md                 # このファイル
└── 出力ファイル:
    ├── chobirich_ios_app_campaigns_YYYY-MM-DD_HH_MM_SS.json
    ├── chobirich_android_app_campaigns_YYYY-MM-DD_HH_MM_SS.json
    └── chobirich_mobile_app_campaigns_combined_YYYY-MM-DD_HH_MM_SS.json
```

## 使用方法

### 基本的な実行

```bash
# 推奨: iOS・Android両方を取得
node main_mobile_app.js

# iOS案件のみ
node main_mobile_app.js ios

# Android案件のみ
node main_mobile_app.js android

# ヘルプ表示
node main_mobile_app.js --help
```

### 出力ファイル形式

**個別OSファイル（例：iOS）**
```json
{
  "scrapeDate": "2025-08-06T10:30:45.123Z",
  "version": "mobile_app_scraper_v2.0.0",
  "systemType": "mobile_app_final",
  "os": "ios",
  "campaigns": [
    {
      "id": "1841392",
      "title": "MONOPOLY GO!",
      "url": "https://www.chobirich.com/ad_details/1841392",
      "points": "12720pt",
      "method": "新規アプリインストール後、各ステップクリア",
      "os": "ios",
      "scrapedAt": "2025-08-06T10:31:15.456Z",
      "source": "mobile_app_scraper"
    }
  ],
  "summary": {
    "total": 287,
    "os": "ios",
    "maxPages": 20,
    "features": [
      "User-Agent切替",
      "1-5桁ポイント対応", 
      "太字タイトル取得",
      "矢印表記対応"
    ]
  }
}
```

## 技術仕様

### User-Agent設定
```javascript
ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
android: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
```

### CSSセレクタ
- メイン案件リスト: `li.CommonSearchItem.App__item`
- タイトル取得: `strong` 要素優先
- リンク取得: `a[href*="/ad_details/"]`

### ページネーション
- URL形式: `https://www.chobirich.com/smartphone?page=N`
- 自動終了: 案件0件ページで停止
- 最大20ページまで対応

## 運用推奨事項

### 🔄 実行頻度
- **日次実行**: 1-2回程度（朝・夕方）
- **週次実行**: フル取得による検証
- **緊急時**: 手動実行（新規キャンペーン期間）

### ⚠️ 注意事項
1. **レート制限**
   - 3秒間隔でページアクセス
   - 403エラー発生時は1時間程度の間隔を空ける

2. **データ品質**
   - ポイント値の桁数確認
   - タイトルの完全性確認
   - OS別案件数の妥当性確認

3. **システム保護**
   - 連続実行の制限
   - エラー時の自動停止
   - ログ監視の実施

## パフォーマンス統計

### 一般的な取得結果
- **iOS案件**: 約280-300件
- **Android案件**: 約280-300件
- **重複なし**: 各OS固有の案件あり
- **高額案件**: 10,000pt以上が10-20件
- **処理効率**: 約28-30件/分

### システムリソース
- **メモリ使用量**: 約100-200MB
- **ディスク容量**: 約5-10MB（出力ファイル）
- **ネットワーク**: 約20-40リクエスト/分

## 更新履歴

### v2.0.0 (2025-08-06) - 完成版
- ポイント抽出ロジック完全修正（桁欠落問題解決）
- タイトル取得精度向上（strong要素優先）
- 20ページ対応確認済み
- コード簡素化（592行→327行、45%削減）
- 保存形式統一（OS別 + まとめファイル）

### v1.0.0 (2025-07-XX) - 初期版
- 基本スクレイピング機能実装
- iOS/Android別User-Agent対応
- ページネーション基本対応

## サポート・トラブルシューティング

### 一般的な問題と解決法

**403 Forbiddenエラー**
```bash
# 解決法: 1-2時間待機してから再実行
node main_mobile_app.js
```

**ポイント値が0ptと表示される**
```bash
# 原因: サイト構造変更の可能性
# 対応: システム管理者に報告
```

**実行時間が異常に長い**
```bash
# 原因: ネットワーク遅延
# 対応: 時間を変えて再実行
```

---

**開発者**: ポイ速プロジェクトチーム  
**最終更新**: 2025-08-06  
**バージョン**: 2.0.0 完成版