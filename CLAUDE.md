# CLAUDE.md - ポイ速プロジェクト開発記録

## プロジェクト概要
ポイ速 (Poisoku) は、ポイントサイトのキャンペーン情報を検索できるWebアプリケーション（Next.js 15.3.4 + Vercel）です。

## ちょびリッチ iOSアプリ案件スクレイピングシステム

### システム仕様書
**目的**: ちょびリッチのiOSアプリ案件データを完全自動取得
**対象**: https://www.chobirich.com/smartphone?sort=point (全ページ)
**出力**: JSON形式のアプリ案件データ

### 確定版スクレイパー
**ファイル**: `/scripts/chobirich-ios-app-full-scraper.js`
**ステータス**: ✅ 完成・テスト済み
**最終更新**: 2025-07-05

### 主要機能
1. **全ページ自動検出**: 21ページすべてを自動でスキャン
2. **リダイレクトURL変換**: `/ad_details/redirect/[ID]/` → `/ad_details/[ID]/`
3. **エラー耐性**: 30接続ごとのブラウザ再起動、チェックポイント保存
4. **高精度データ抽出**:
   - 案件タイトル
   - 案件URL (直接URL)
   - 還元率 (ポイント/%)
   - OS判定 (iOS/Android/両対応)
   - 獲得条件 (改良済み - 不適切テキスト除外)

### 実績データ
- **取得成功**: 620件のアプリ案件
- **OS内訳**: iOS 543件、両OS対応 76件、Android専用 0件
- **エラー率**: 0.16% (1/620)

### 技術的特徴
```javascript
// iOS専用ユーザーエージェント (Android UAは403エラーになるため)
iosUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'

// リダイレクトURL変換ロジック
convertRedirectToDirectUrl(url) {
  const redirectPattern = /\/ad_details\/redirect\/(\d+)\/?$/;
  const match = url.match(redirectPattern);
  if (match) {
    return `${this.baseUrl}/ad_details/${match[1]}/`;
  }
  return url;
}

// 改良されたmethod取得ロジック (不適切テキスト除外)
const excludePatterns = [
  /インストール日・時刻/,
  /広告主発行の申込完了メール/,
  /プレイヤー情報画面キャプチャ/,
  /アプリの場合はプレイヤー情報/,
  /などが必要です/
];
```

### 実行方法
```bash
node scripts/chobirich-ios-app-full-scraper.js
```

### 出力ファイル
- **メイン**: `chobirich_all_app_campaigns.json` (全アプリ案件データ)
- **チェックポイント**: `chobirich_full_checkpoint.json` (進捗保存)

### データ構造
```json
{
  "scrape_date": "2025-07-05T02:21:35.458Z",
  "strategy": "full_ios_app_scraper",
  "summary": {
    "total_processed": 620,
    "app_campaigns_found": 620,
    "errors": 1,
    "os_breakdown": {
      "ios": 543,
      "android": 0,
      "both": 76,
      "unknown": 1
    }
  },
  "app_campaigns": [
    {
      "id": "1835496",
      "name": "ピコットタウン レベル32到達（iOS）",
      "url": "https://www.chobirich.com/ad_details/1835496/",
      "cashback": "160pt",
      "os": "ios",
      "method": "新規アプリインストール後、レベル32到達で成果",
      "timestamp": "2025-07-05T01:38:20.780Z"
    }
  ]
}
```

### 重要な技術的制約
1. **必ずiOS UA使用**: Android UAでは403 Forbiddenエラー
2. **リダイレクトURL対応**: 変換しないとデータ取得不可
3. **ブラウザ再起動必須**: 30-40接続で接続エラー対策
4. **除外パターン必須**: methodフィールドの品質確保

### システム保護
⚠️ **このスクレイピングシステムは完成版です**
- methodフィールドの取得ロジックは改良済み
- 不適切なテキスト除外パターンが実装済み
- 620件の実績データで動作確認済み
- **変更・改修は不要です**

## ちょびリッチ 差分取得システム

### 新システム概要
**目的**: 新規・変更案件のみを効率的に取得し、90-95%の時間短縮を実現
**実装日**: 2025-07-05

### 差分取得システム仕様
**ファイル**: `/scripts/chobirich-differential-system.js`
**統合実行**: `/scripts/run-differential.js`

### 技術的特徴
1. **ハッシュベース変更検出**: MD5ハッシュでデータ変更を検出
2. **段階的処理**:
   - Phase 1: 全URL抽出（軽量・高速）
   - Phase 2: 新規案件特定
   - Phase 3: 新規案件の完全データ取得
   - Phase 4: 既存案件の軽量チェック
   - Phase 5: 変更検出案件の詳細取得
3. **プラットフォーム対応**: iOS・Android両対応

### パフォーマンス効果
- **従来**: 全件取得 2-4時間（1154件）
- **差分取得**: 15-60分（通常15-70件のみ処理）
- **短縮率**: 85-95%

### 実行方法
```bash
# iOS差分取得のみ
node scripts/chobirich-differential-system.js ios

# Android差分取得のみ  
node scripts/chobirich-differential-system.js android

# iOS・Android統合差分取得
node scripts/run-differential.js
```

### ハッシュ生成ロジック
```javascript
createDataHash(campaign) {
  const key = `${campaign.name}|${campaign.cashback}|${campaign.method}|${campaign.os}`;
  return crypto.createHash('md5').update(key).digest('hex');
}
```

### 検出対象の変更
- 案件タイトル変更
- 還元率（cashback）変更
- 獲得条件（method）変更
- OS対応変更

### データ保存
- iOS: `chobirich_all_app_campaigns.json` 
- Android: `chobirich_android_app_campaigns.json`

⚠️ **運用推奨**: 
- 日次: 差分取得（15-60分）
- 週次: フル取得検証（全件確認用）

## 開発者向けメモ
**スクレイピング再実行時の注意**:
- 差分取得システムを優先利用
- 大量アクセスとならないよう間隔調整
- ブラウザリソース管理のための定期再起動
- チェックポイント機能による中断・再開対応