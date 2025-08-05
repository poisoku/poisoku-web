# ちょびリッチスクレイピングシステム

効率的な差分取得とデータベース保存機能を搭載したちょびリッチキャンペーン情報スクレイピングシステムです。

## 🚀 特徴

- **差分取得システム**: 90-95%の時間短縮を実現
- **詳細データ取得**: 案件詳細ページから完全なデータを取得
- **データベース対応**: Supabase（PostgreSQL）自動保存
- **403エラー対策**: 自動レート制限とエラー回復機能
- **バックアップ機能**: ローカルファイルバックアップで安全性確保

## 📦 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数設定（オプション）

```bash
cp .env.example .env
# .envファイルを編集してSupabase設定を追加
```

### 3. 設定ファイル確認

- `config/rate_limit.yml` - レート制限設定
- `config/chobirich_urls.yml` - 取得対象URL設定

## 🎯 使用方法

### 差分取得（推奨）

```bash
# 差分取得実行
npm run differential

# または
node differential.js
```

### 全件取得

```bash
# 全件取得実行
npm run start

# または
node main.js
```

### テスト実行

```bash
# 通常テスト（1カテゴリのみ）
npm run test

# 差分取得テスト
npm run test-diff
```

### 403エラー分析

```bash
npm run analyze
```

## 🔄 差分取得システム

### 動作原理

1. **ハッシュベース変更検出**: MD5ハッシュでデータ変更を検出
2. **段階的処理**: 
   - 新規案件の特定
   - 変更案件の検出
   - 必要な案件のみ詳細取得
3. **効率化**: 変更のない案件はスキップ

### 効率化実績

- **従来**: 全件取得 2-4時間（1000+件）
- **差分取得**: 15-60分（通常15-70件のみ処理）
- **短縮率**: 85-95%

## 💾 データ保存

### データベース保存（Supabase）

環境変数を設定すると自動的にSupabaseデータベースに保存されます：

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### ローカルバックアップ

データベース設定に関係なく、常にローカルファイルにバックアップを保存：

- `data/` - 通常のスクレイピング結果
- `data/backups/` - データベース保存用バックアップ
- `data/campaign_hashes.json` - 差分検出用ハッシュデータ

## 📊 データ構造

```json
{
  "id": "1234567",
  "title": "キャンペーン名",
  "points": "100pt",
  "condition": "獲得条件",
  "description": "詳細説明",
  "category": "shopping",
  "categoryName": "ショッピング",
  "device": "pc",
  "url": "/ad_details/1234567/",
  "scrapedAt": "2025-08-04T12:00:00.000Z",
  "hash": "abcd1234...",
  "changeType": "new"
}
```

## ⚙️ 設定

### レート制限設定 (`config/rate_limit.yml`)

```yaml
rate_limit:
  requests_per_minute: 20        # 分あたりリクエスト数
  delay_between_requests: 3      # リクエスト間隔（秒）
  delay_between_categories: 10   # カテゴリ間隔（秒）
  max_pages_per_category: 50     # カテゴリあたり最大ページ数
```

### URL設定 (`config/chobirich_urls.yml`)

取得対象のカテゴリとURLを定義。21カテゴリ（ショッピング11、サービス9、アプリ1）をサポート。

## 🕐 推奨スケジュール

### 日次実行（差分取得）

```bash
# crontabの例
0 4,11,15,19 * * * cd /path/to/scrapers && npm run differential
```

### 週次実行（全件取得）

```bash
# 週1回の全件取得（検証用）
0 2 * * 0 cd /path/to/scrapers && npm run start
```

## 📈 統計・監視

実行後に表示される統計情報：

- 取得案件数
- 処理時間
- 403エラー発生率
- 差分統計（新規・変更・削除）
- データベース保存結果

## 🛠️ トラブルシューティング

### 403エラーが多い場合

1. `config/rate_limit.yml`でリクエスト間隔を延長
2. `npm run analyze`でエラーパターンを分析
3. 一時的にスクレイピングを停止

### データベース接続エラー

1. Supabase設定を確認
2. ローカルバックアップは常に保存されるため安心
3. `.env`ファイルの設定値を再確認

### メモリ不足

- ブラウザが自動的に再起動される仕組みを実装済み
- 大量処理時は分割実行を推奨

## 📚 ファイル構成

```
scrapers/
├── main.js                  # メイン実行ファイル
├── differential.js          # 差分取得実行ファイル
├── package.json
├── .env.example            # 環境変数サンプル
├── README.md
├── config/
│   ├── rate_limit.yml      # レート制限設定
│   └── chobirich_urls.yml  # URL設定
├── src/
│   ├── core/
│   │   ├── RateLimiter.js      # レート制限管理
│   │   ├── DifferentialManager.js # 差分取得管理
│   │   └── DatabaseManager.js     # データベース管理
│   └── sites/
│       └── chobirich/
│           └── ChobirichScraper.js # メインスクレイパー
└── data/
    ├── backups/            # データベース用バックアップ
    └── campaign_hashes.json # 差分検出用ハッシュ
```

## 🔄 システム更新履歴

### v1.0.0
- 初回リリース
- 差分取得システム実装
- データベース保存機能
- 403エラー対策強化
- 詳細データ取得機能