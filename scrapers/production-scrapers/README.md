# 🚀 本番スクレイパー (Production Scrapers)

## ⚠️ 重要事項
**このディレクトリ内のスクレイパーは本番環境で稼働中です。**
- 変更前に必ずバックアップを取ってください
- テストは`development/`フォルダで行ってください
- 本番への反映は慎重に行ってください

## 📊 システム一覧

| サイト | スクレイパー | 取得能力 | 状態 |
|--------|------------|----------|------|
| **ちょびリッチ** | ChobirichCompleteV3.js | 3,662件（Web+アプリ） | ✅ 本番稼働中 |
| **モッピー** | MoppyWebScraperV2.js<br>MoppyAppScraperV3.js | 2,419件<br>（Web: 1,902件、アプリ: 517件） | ✅ 本番稼働中 |
| **ポイントインカム** | - | - | 🔧 準備中 |

## 🎯 合計取得能力
- **総案件数**: 6,081件
- **Web案件**: 4,673件
- **アプリ案件**: 1,408件

## 📝 基本的な使用方法

### 全サイト一括取得
```bash
# ちょびリッチ
cd chobirich && node ChobirichCompleteV3.js

# モッピー
cd moppy && node MoppyWebScraperV2.js && node MoppyAppScraperV3.js
```

### データ保存先
```
scrapers/data/
├── chobirich/
│   └── chobirich_production_complete_v3.json
├── moppy/
│   ├── moppy_web_v2_*.json
│   └── moppy_app_v3_*.json
└── pointincome/  # 準備中
```

## 🔧 メンテナンス

### バックアップ作成
```bash
# 実行前に必ずバックアップ
cp -r production-scrapers production-scrapers.backup.$(date +%Y%m%d)
```

### テスト実行
```bash
# developmentフォルダでテスト
cd development
# テストコードを実行
```

### 本番反映手順
1. developmentでテスト完了
2. バックアップ作成
3. production-scrapersに移動
4. 動作確認
5. GitHubにpush

## 📈 実行スケジュール（推奨）

| 時間帯 | サイト | 理由 |
|--------|--------|------|
| 深夜2:00 | ちょびリッチ | サーバー負荷最小 |
| 深夜3:00 | モッピー | 連続実行回避 |
| 深夜4:00 | ポイントインカム | 準備中 |

## 🚨 緊急時対応

### スクレイパーが停止した場合
1. エラーログ確認
2. バックアップから復元
3. 待機時間を延長して再実行

### 403エラーが頻発する場合
1. 24時間待機
2. User-Agent更新
3. 待機時間延長（2倍）

## 📊 監視項目
- 取得件数の急激な変動（±20%以上）
- 実行時間の異常（通常の2倍以上）
- エラー率（5%以上）

## 🔄 更新履歴
- 2025-08-16: モッピースクレイパー本番化
- 2025-08-06: ちょびリッチV3完成
- 2025-08-16: production-scrapersフォルダ作成

---
**注意**: このフォルダへの直接的な変更は避け、必ずテスト後に反映してください。