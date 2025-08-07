# ポイ速 ちょびリッチデータ更新システム - 本番環境デプロイメントガイド

最終更新: 2025-08-06

## 🚀 システム概要

### 達成された成果
- **100%案件取得**: 3,644件のちょびリッチ全案件を取得
- **高精度データ変換**: ポイント→円表記の自動変換
- **データ品質保証**: 自動検証・修正システム
- **リアルタイム検索**: ポイ速での即時検索可能

### システム構成
1. **v3スクレイピングシステム** - Protocol error完全回避で全案件取得
2. **データ変換システム** - v3形式→検索用JSON形式変換  
3. **検証・修正システム** - データ品質の自動チェック・修正
4. **Vercel自動デプロイ** - GitHubプッシュで自動反映

## 📋 本番運用手順

### 1. データ更新の実行（日次推奨）

```bash
# 作業ディレクトリに移動
cd /Users/kn/poisoku-web/scrapers

# v3システムで最新データ取得（約45分）
node complete_chobirich_system_v3.js

# 検索用データに変換
node convert_v3_to_search_data.js

# データ検証・修正
node validate_and_fix_point_data.js

# Vercelへデプロイ
cd ..
git add public/search-data.json
git commit -m "chore: Update Chobirich campaign data $(date +%Y-%m-%d)"
git push origin main
```

### 2. 緊急修正が必要な場合

特定の案件データに問題がある場合：

```bash
# 修正スクリプトを作成
cd /Users/kn/poisoku-web/scrapers
node fix_specific_campaign.js  # 必要に応じて作成

# 即座にデプロイ
cd ..
git add public/search-data.json
git commit -m "fix: 案件データ修正"
git push origin main
```

## 🛠️ 重要ファイル一覧

### スクレイピングシステム
- `scrapers/complete_chobirich_system_v3.js` - メイン取得システム
- `scrapers/src/sites/chobirich/ExtendedChobirichScraper.js` - Web案件用
- `scrapers/src/sites/chobirich/MobileAppScraper.js` - アプリ案件用

### データ処理システム
- `scrapers/convert_v3_to_search_data.js` - データ変換
- `scrapers/validate_and_fix_point_data.js` - データ検証・修正
- `scrapers/fix_device_display.js` - デバイス表記修正
- `scrapers/fix_mafia_campaign.js` - 個別案件修正例

### データファイル
- `scrapers/data/chobirich_production_complete_v3.json` - v3生データ
- `public/search-data.json` - 検索用データ（本番）
- `public/search-data-backup.json` - バックアップ

## 🔍 既知の問題と対策

### 1. アプリランド案件の桁落ち
**問題**: 1,000pt未満のアプリランド案件は桁落ちの可能性
**対策**: `validate_and_fix_point_data.js`が自動的に10倍修正

### 2. 先頭ゼロ問題
**問題**: 109342pt → 09342pt のような先頭数字欠落
**対策**: 検証システムが自動検出・修正

### 3. デバイス表記
**確定仕様**:
- データ: "All" → UI表示: "すべて"
- データ: "iOS" → UI表示: "iOS"
- データ: "Android" → UI表示: "Android"
- データ: "iOS/Android" → UI表示: "スマホ"

## 📊 データ品質チェックリスト

更新後は以下を確認：

1. **総案件数**: 3,500件以上あるか
2. **最高額案件**: 5万円以上の案件が存在するか
3. **デバイス分布**: 「すべて」が最多か
4. **検索テスト**: 
   - "楽天市場" → 1%還元が表示されるか
   - "マフィア" → 54,671円が表示されるか
   - デバイスフィルターが正常動作するか

## 🚨 トラブルシューティング

### Protocol error発生時
```bash
# v3システムが自動回復するが、手動介入が必要な場合
# チェックポイントから再開
node complete_chobirich_system_v3.js
```

### データ不整合発生時
```bash
# 全データ再検証
node validate_and_fix_point_data.js

# 必要なら完全再取得
node complete_chobirich_system_v3.js
```

### Vercel反映されない時
1. GitHubへのプッシュを確認
2. Vercelダッシュボードでビルドステータス確認
3. 5-10分待機（通常2-5分で反映）

## 📅 推奨運用スケジュール

### 日次（深夜2-4時推奨）
- v3システムによる全案件取得
- データ変換・検証
- Vercelデプロイ

### 週次
- データ品質レポート確認
- 異常値の手動チェック

### 月次
- システム全体のメンテナンス
- スクレイパーロジックの更新確認

## 🔐 セキュリティ注意事項

- スクレイピング間隔は適切に保つ（サーバー負荷軽減）
- 個人情報は取得・保存しない
- APIキーなどは環境変数で管理

## 📞 サポート情報

問題発生時の対応：
1. エラーログの確認
2. このガイドのトラブルシューティング実施
3. 必要に応じてシステム改修

---

## 更新履歴
- 2025-08-06: 初版作成（v3.0システム、3,644件取得成功）