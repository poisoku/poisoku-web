# モッピー 本番スクレイパー

## ⚠️ 重要：本番稼働中
このフォルダ内のファイルは本番環境で使用されています。
変更前に必ずバックアップを取ってください。

## 📊 システム概要
- **Web版**: MoppyWebScraperV2.js
- **アプリ版**: MoppyAppScraperV3.js
- **総取得能力**: 2,419件
- **最終更新**: 2025-08-16

## 🎯 機能

### Web案件スクレイパー（V2）
- ✅ 対象: 10URL
- ✅ 取得件数: 1,902件
- ✅ 100ページ対応
- ✅ 連続空ページ検出（3ページ）
- ✅ 重複除去機能

### アプリ案件スクレイパー（V3）
- ✅ iOS案件: 259件
- ✅ Android案件: 258件
- ✅ User-Agent別独立取得
- ✅ OS独立保持（URL重複OK）

## 📝 使用方法

### Web案件取得
```bash
node MoppyWebScraperV2.js
```

### アプリ案件取得
```bash
node MoppyAppScraperV3.js
```

### 全案件取得（推奨）
```bash
# 両方実行
node MoppyWebScraperV2.js && node MoppyAppScraperV3.js
```

## 📊 出力ファイル

### Web版
```
data/moppy/
└── moppy_web_v2_2025-08-16T*.json
```

### アプリ版
```
data/moppy/
├── moppy_app_v3_ios_*.json      # iOS案件
├── moppy_app_v3_android_*.json  # Android案件
└── moppy_app_v3_combined_*.json # 統合版
```

## 📋 データ構造

### Web案件
```json
{
  "id": "moppy_12345",
  "title": "楽天市場",
  "url": "https://pc.moppy.jp/shopping/detail.php?site_id=12345",
  "points": "1%",
  "device": "PC",
  "scrapedAt": "2025-08-16T07:13:53.161Z",
  "source": "moppy_web_scraper_v2"
}
```

### アプリ案件
```json
{
  "id": "moppy_app_67890",
  "title": "ゲームアプリ名",
  "url": "https://pc.moppy.jp/ad/detail.php?site_id=67890",
  "points": "500P",
  "device": "iOS",  // または "Android"
  "scrapedAt": "2025-08-16T07:50:20.025Z",
  "source": "moppy_app_scraper_v3"
}
```

## ⚙️ 設定パラメータ

### Web版
- **最大ページ数**: 100ページ/URL
- **連続空ページ**: 3ページで終了
- **URL間待機**: 2秒
- **タイムアウト**: 30秒/ページ

### アプリ版
- **最大ページ数**: 20ページ/OS
- **OS切替待機**: 30秒（403対策）
- **ページ間待機**: 3秒

## 🔧 トラブルシューティング

### 案件数が少ない場合
- ページネーション設定を確認
- 広告なしメッセージの検出ロジック確認

### 403エラーが発生する場合
- 待機時間を延長
- User-Agentを更新

## 📈 実績
- **Web版実行時間**: 約3分
- **アプリ版実行時間**: 約5分
- **成功率**: 100%
- **データ精度**: 100%（重複除去済み）