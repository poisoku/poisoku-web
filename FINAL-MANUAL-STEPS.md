# 🎯 最終手動実行手順

## 現在の状況
- 獅子の如くのデータは`pointincome_mobile_batch_final.json`に存在（Android版・iOS版共に2000円）
- search-data.jsonには含まれていない（統合が不完全）
- 緊急修正が必要

## 手動実行手順

### ステップ1: データベース統合を実行

```bash
cd /Users/kn/poisoku-web/scripts/pointincome
node integrate-to-database.js
```

**期待される出力:**
```
🔄 ポイントインカムデータのデータベース統合開始
📂 データファイル読み込み中...
📊 メインカテゴリ: 1043件
📱 モバイルアプリ: 100件
📋 合計案件数: 1143件
...
📊 カテゴリ別内訳:
  app: 100件
  shopping: 1043件
  other: 0件
...
🎉 データベース統合完了！
```

### ステップ2: 検索データ再生成

```bash
cd /Users/kn/poisoku-web
node scripts/generate-search-data.js
```

**期待される出力:**
```
🚀 静的サイト用検索データ生成開始
...
✅ 3950件程度のキャンペーンを取得（モバイルアプリ追加で増加）
...
🎉 検索データ生成完了
```

### ステップ3: 結果確認

```bash
# 獅子の如くが含まれているかチェック
grep -n "獅子の如く" public/search-data.json

# 期待される結果: 2行（iOS版とAndroid版）
# 例: 
# 1234:      "description": "7/31で終了！獅子の如く【四季の祝福 購入】（Android用）",
# 5678:      "description": "7/31で終了！獅子の如く【四季の祝福 購入】（iOS用）",

# デバイス別案件数確認
grep -c '"device": "iOS"' public/search-data.json
grep -c '"device": "Android"' public/search-data.json

# カテゴリ別確認（categoryカラムが追加されている場合）
grep -c '"category": "app"' public/search-data.json
```

### ステップ4: 最終デプロイ

```bash
git add .
git commit -m "Complete mobile app integration with 獅子の如く campaigns

- Successfully integrate mobile app campaigns including 獅子の如く (2000円)
- Add proper category mapping for app vs shopping campaigns  
- Include iOS and Android game campaigns in search results
- Fix search data generation to include all PointIncome mobile apps

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

## トラブルシューティング

### 問題1: "column category does not exist" エラー

**解決策**: Supabaseダッシュボードで以下のSQLを実行:
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
```

### 問題2: 統合はできたが獅子の如くが見つからない

**確認コマンド**:
```bash
# データベースに獅子の如くが存在するかチェック
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://pjjhyzbnnslaauwzknrr.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM');
supabase.from('campaigns').select('name, device, cashback_rate').ilike('name', '%獅子の如く%').then(result => console.log(result.data));
"
```

### 問題3: 緊急修正が必要な場合

```bash
node quick-fix-integration.js
```

## 成功の確認方法

### 1. 技術的確認
- `grep "獅子の如く" public/search-data.json` で2件のヒット
- iOS版とAndroid版それぞれ2000円の表示
- `"device": "iOS"` と `"device": "Android"` の案件が増加

### 2. 実際のサイトでの確認
1. https://poisoku.jp にアクセス
2. 検索バーに「獅子の如く」を入力
3. 2つの結果（iOS版・Android版）が表示される
4. それぞれ2000円の還元率が表示される

### 3. 期待される最終結果
- 総キャンペーン数: 3950件以上（モバイルアプリ100件追加）
- 獅子の如く: iOS版・Android版共に表示
- カテゴリフィルタリング機能（categoryカラム追加の場合）

## 重要ポイント

✅ **データは既に存在**: `pointincome_mobile_batch_final.json`に正しいデータが保存済み
✅ **統合スクリプト修正済み**: categoryマッピングロジックを追加済み
✅ **フォールバック機能**: categoryカラムがなくても動作する

あとは上記の手順を実行するだけで、獅子の如くが検索結果に表示されるようになります！