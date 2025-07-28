# モバイルアプリデータ統合修正手順

獅子の如くなどのモバイルアプリ案件がsearch-data.jsonに表示されない問題を修正するための手順です。

## 問題の概要

1. モバイルアプリのスクレイピングは成功している
2. データベース統合でcategoryフィールドが欠落している
3. search-data.jsonでモバイルアプリ案件が除外されている

## 修正手順

### ステップ1: 現在のデータベース状態を確認

```bash
cd /Users/kn/poisoku-web
node scripts/pointincome/enhanced-schema-check.js
```

このスクリプトは以下を確認します：
- campaignsテーブルにcategoryカラムが存在するか
- ポイントインカムのデータがどのように保存されているか
- 獅子の如くの案件がデータベースに存在するか

### ステップ2: categoryカラムを追加（必要な場合）

スキーマチェックでcategoryカラムが存在しない場合：

1. Supabaseダッシュボードにアクセス
2. SQL Editorを開く
3. `scripts/pointincome/add-category-schema.sql`の内容を実行

または手動で以下のSQLを実行：
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
```

### ステップ3: 修正されたデータベース統合スクリプトを実行

```bash
cd /Users/kn/poisoku-web
node scripts/pointincome/integrate-to-database.js
```

このスクリプトは以下を行います：
- pointincome_batch_final.json (1,043件のメインカテゴリ)
- pointincome_mobile_batch_final.json (100件のモバイルアプリ)
- 両方のデータを適切なcategoryで統合
- モバイルアプリは`category: 'app'`として保存

### ステップ4: search-data.jsonを再生成

```bash
cd /Users/kn/poisoku-web
node scripts/generate-search-data.js
```

### ステップ5: 結果確認

```bash
# 獅子の如くが検索データに含まれているかチェック
grep -n "獅子の如く" public/search-data.json

# モバイルアプリカテゴリの案件数をチェック
grep -c '"category": "app"' public/search-data.json
```

### ステップ6: Vercelにデプロイ

```bash
git add .
git commit -m "Fix mobile app data integration and regenerate search data

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

## 修正内容の詳細

### integrate-to-database.js の修正点

1. **categoryマッピングロジックの追加**:
   ```javascript
   // カテゴリマッピング
   let category = 'other';
   if (campaign.category) {
     if (campaign.category === 'モバイルアプリ' || campaign.categoryType === 'app') {
       category = 'app';
     } else if (campaign.category.includes('ショッピング') || campaign.category.includes('EC')) {
       category = 'shopping';
     }
     // ... その他のマッピング
   }
   ```

2. **データベースへのcategory保存**:
   ```javascript
   return {
     name: name,
     point_site_id: pointSiteId,
     cashback_rate: cashbackRate,
     device: device,
     campaign_url: campaign.campaignUrl,
     description: description,
     category: category,  // 追加
     is_active: true
   };
   ```

3. **統計情報の追加**: カテゴリ別の統計を表示

## 期待される結果

修正後は以下が実現されます：

1. **獅子の如くの案件が検索結果に表示される**
   - Android版: 2000円
   - iOS版: 2000円

2. **モバイルアプリカテゴリの正しい処理**
   - `category: "app"`として分類
   - `device: "iOS"` または `device: "Android"`として正しく識別

3. **search-data.jsonの内容**
   - 約100件のモバイルアプリ案件が追加
   - 合計約1,200件のポイントインカム案件

## トラブルシューティング

### 問題1: categoryカラムが追加できない
- Supabaseダッシュボードで手動でSQL実行
- ANON KEYではDDL実行権限がない場合があります

### 問題2: 統合スクリプトでエラー
- .env.localファイルの設定を確認
- Supabaseの接続情報が正しいかチェック

### 問題3: 獅子の如くが見つからない
- pointincome_mobile_batch_final.jsonに データが存在するか確認
- スクレイピングが正常に完了しているかチェック

## 確認コマンド

```bash
# モバイルデータの存在確認
grep -c "獅子の如く" scripts/pointincome/pointincome_mobile_batch_final.json

# 統合レポートの確認
cat scripts/pointincome/integration_report.json

# 検索データの確認
head -200 public/search-data.json | grep -A 10 -B 5 "ポイントインカム"
```