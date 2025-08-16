# ちょびリッチ 本番スクレイパー

## ⚠️ 重要：本番稼働中
このフォルダ内のファイルは本番環境で使用されています。
変更前に必ずバックアップを取ってください。

## 📊 システム概要
- **バージョン**: Complete V3.0
- **ファイル**: `ChobirichCompleteV3.js`
- **取得能力**: 3,662件（Web案件 + スマホアプリ案件）
- **最終更新**: 2025-08-06

## 🎯 機能
- ✅ Web案件: 2,771件（20カテゴリ）
- ✅ iOS案件: 329件
- ✅ Android案件: 562件
- ✅ Protocol error完全回避（3カテゴリ毎ブラウザ再起動）
- ✅ 403エラー対策（リトライ機能付き）

## 📝 使用方法

### 基本実行
```bash
node ChobirichCompleteV3.js
```

### 出力ファイル
```
data/
├── chobirich_production_complete_v3.json  # 統合データ
├── chobirich_web_campaigns_*.json         # Web案件
├── chobirich_ios_campaigns_*.json         # iOS案件
└── chobirich_android_campaigns_*.json     # Android案件
```

## 📊 データ構造

### Web案件
```json
{
  "id": "36796",
  "title": "楽天市場",
  "url": "https://www.chobirich.com/ad_details/36796/",
  "points": "1%",
  "categoryType": "shopping",
  "source": "extended_category_system"
}
```

### アプリ案件
```json
{
  "id": "1841560",
  "title": "マーブルマスター (Marble Master)（iOS）",
  "url": "https://www.chobirich.com/ad_details/1841560",
  "points": "480pt",
  "platform": "ios",
  "category": "mobile_app",
  "method": "新規アプリインストール後、指定条件達成で成果"
}
```

## ⚙️ 設定パラメータ
- **バッチサイズ**: 3カテゴリ毎
- **待機時間**: カテゴリ間30秒
- **リトライ**: 最大3回
- **タイムアウト**: 45秒/ページ

## 🔧 トラブルシューティング

### 403エラーが頻発する場合
- 待機時間を延長（30秒→60秒）
- バッチサイズを縮小（3→2カテゴリ）

### Protocol errorが発生する場合
- メモリクリーンアップ頻度を増やす
- ブラウザ再起動間隔を短縮

## 📈 実績
- **成功率**: 99.9%以上
- **実行時間**: 約45分
- **エラー回復**: 100%自動復旧