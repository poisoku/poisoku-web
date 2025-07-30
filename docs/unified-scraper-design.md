# ちょびリッチ統一スクレイピングシステム設計書

## 目的
複数存在するスクレイピングシステムを1つに統一し、全てのちょびリッチ案件データを確実に取得する

## 現状の問題点
1. **複数のスクレイパーが乱立** - iOS用、Android用、ショッピング用、サービス用など
2. **メンテナンス性が低い** - 各スクレイパーで重複したコード
3. **一貫性がない** - データ形式やエラー処理が統一されていない
4. **403エラー問題** - 最新実行時に全スクレイパーが403エラー

## 統一システムのアーキテクチャ

### ベースとなるシステム
`chobirich-ios-app-full-scraper.js`の実装をベースとする

**選定理由:**
- 最も高い成功率（99.84%）
- 620件の実績
- 完成度の高いエラー処理
- リダイレクトURL変換機能

### カテゴリ構造
ちょびリッチの主要カテゴリ:
1. **ショッピング** - `/shopping/shop/101-112` (12カテゴリ)
2. **サービス** - `/service/` 
3. **アプリ** - `/smartphone?sort=point` (iOS/Android)
4. **クレジットカード** - `/creditcard/`
5. **その他** - 旅行、ゲームなど

### 統一データ構造
```javascript
{
  "id": "1234567",
  "name": "案件名",
  "url": "https://www.chobirich.com/ad_details/1234567/",
  "cashback": "1000pt", // または "5%"
  "category": "shopping", // shopping, service, app, credit, other
  "subcategory": "fashion", // 詳細カテゴリ
  "device": "all", // all, ios, android
  "method": "商品購入",
  "description": "詳細な説明",
  "timestamp": "2025-07-30T00:00:00.000Z"
}
```

## 実装方針

### 1. 基本構造
```javascript
class ChobirichUnifiedScraper {
  constructor() {
    // 共通設定
    this.baseUrl = 'https://www.chobirich.com';
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)...';
    
    // カテゴリ定義
    this.categories = {
      shopping: {
        baseUrl: '/shopping/shop/',
        ids: Array.from({length: 12}, (_, i) => 101 + i)
      },
      service: {
        baseUrl: '/service/',
        pagination: true
      },
      app: {
        baseUrl: '/smartphone',
        params: '?sort=point'
      },
      credit: {
        baseUrl: '/creditcard/',
        pagination: true
      }
    };
  }
}
```

### 2. 共通機能
- **ブラウザ管理**: 30接続ごとの再起動
- **エラー処理**: リトライ機能、チェックポイント
- **URL変換**: リダイレクトURL → 直接URL
- **データ検証**: 無効データのフィルタリング
- **進捗管理**: プログレスバー、ログ出力

### 3. 403エラー対策
```javascript
// 1. 人間らしいアクセスパターン
await this.randomDelay(3, 8); // 3-8秒のランダム待機

// 2. Cookie管理
await page.setCookie(...previousCookies);

// 3. ヘッダー設定
await page.setExtraHTTPHeaders({
  'Accept-Language': 'ja-JP,ja;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache'
});

// 4. ページ遷移パターン
// トップページ → カテゴリ → 詳細ページ
```

### 4. 差分取得機能
- 既存データとの比較
- MD5ハッシュによる変更検出
- 新規・変更案件のみ詳細取得

## 実装ステップ

1. **Phase 1: 基本実装**
   - 統一スクレイパークラスの作成
   - 共通機能の実装
   - データ構造の統一

2. **Phase 2: カテゴリ対応**
   - 各カテゴリのスクレイピングロジック
   - ページネーション処理
   - URL抽出・変換

3. **Phase 3: エラー対策**
   - 403エラー回避機能
   - リトライ機能
   - チェックポイント機能

4. **Phase 4: 最適化**
   - 差分取得機能
   - パフォーマンスチューニング
   - ログ・監視機能

## 期待される効果
1. **保守性向上** - 1つのコードベースで管理
2. **信頼性向上** - 統一されたエラー処理
3. **効率性向上** - 差分取得で時間短縮
4. **拡張性向上** - 新カテゴリの追加が容易