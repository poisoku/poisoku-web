# 即座に実行すべきアクション

## 現在の状況
- モバイルアプリデータ（獅子の如くを含む）がスクレイピングされているが、search-data.jsonに表示されない
- 原因：campaignsテーブルにcategoryカラムが存在しない
- 統合スクリプトを修正済み

## 実行手順

### 1. categoryカラムなしでデータベース統合（暫定対応）

```bash
cd /Users/kn/poisoku-web/scripts/pointincome
node integrate-to-database-no-category.js
```

期待される出力:
- 📊 メインカテゴリ: 1043件
- 📱 モバイルアプリ: 100件
- 📋 合計案件数: 1143件

### 2. 検索データを再生成

```bash
cd /Users/kn/poisoku-web
node scripts/generate-search-data.js
```

期待される出力:
- 総キャンペーン数: 3000件以上
- ポイントインカム: 1141件（モバイルアプリ含む）

### 3. 結果確認

```bash
# 獅子の如くが含まれているか確認
grep "獅子の如く" public/search-data.json

# デバイス別の件数確認
grep -c '"device": "iOS"' public/search-data.json
grep -c '"device": "Android"' public/search-data.json
```

### 4. Supabaseでcategoryカラムを追加

1. [Supabaseダッシュボード](https://app.supabase.com)にログイン
2. SQL Editorを開く
3. 以下のSQLを実行:

```sql
-- categoryカラムを追加
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaigns_category_device ON campaigns(category, device);

-- 確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
ORDER BY ordinal_position;
```

### 5. categoryカラムありで再統合（カラム追加後）

```bash
cd /Users/kn/poisoku-web/scripts/pointincome
node integrate-to-database.js
```

### 6. 最終的な検索データ生成

```bash
cd /Users/kn/poisoku-web
node scripts/generate-search-data.js
```

### 7. デプロイ

```bash
git add .
git commit -m "Fix mobile app data integration for PointIncome

- Add category mapping for mobile apps
- Include iOS/Android game campaigns in search data
- Fix 獅子の如く campaign visibility issue

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

## 確認ポイント

✅ 獅子の如く（iOS/Android）が検索結果に表示される
✅ モバイルアプリ案件が約100件追加される
✅ デバイス別フィルタが正しく機能する

## トラブルシューティング

### エラー: column "category" does not exist
→ ステップ1の`integrate-to-database-no-category.js`を使用

### エラー: permission denied
→ Supabaseダッシュボードで手動でSQLを実行

### 獅子の如くが見つからない
→ `pointincome_mobile_batch_final.json`を確認して、データが存在することを確認