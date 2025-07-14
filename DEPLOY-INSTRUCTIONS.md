# デプロイ手順

## 変更内容の確認

このリリースで追加・修正されたファイル：

### 新規作成ファイル
- `scripts/pointincome/integrate-to-database-no-category.js` - categoryカラムなしでの統合スクリプト
- `scripts/pointincome/enhanced-schema-check.js` - 詳細なスキーマチェックスクリプト
- `scripts/pointincome/add-category-column.js` - categoryカラム追加スクリプト
- `scripts/pointincome/add-category-schema.sql` - SQLスキーマ変更
- `scripts/pointincome/check-schema.js` - スキーマ確認スクリプト
- `scripts/pointincome/README-FIX-MOBILE-APPS.md` - 修正手順書
- `scripts/run-integration.sh` - 統合実行スクリプト
- `IMMEDIATE-ACTIONS.md` - 即時実行手順
- `DEPLOY-INSTRUCTIONS.md` - このファイル
- `add_category_column.sql` - カラム追加SQL

### 修正ファイル
- `scripts/pointincome/integrate-to-database.js` - カテゴリマッピング追加

## Gitコミット手順

```bash
# 1. 変更をステージング
git add -A

# 2. ステータス確認
git status

# 3. コミット
git commit -m "Fix mobile app data integration for PointIncome

- Add category mapping logic to database integration
- Create scripts to handle missing category column
- Add enhanced schema checking and migration tools
- Fix issue where mobile app campaigns (including 獅子の如く) were not appearing in search results
- Prepare for proper categorization of app campaigns vs shopping campaigns

Key changes:
- Modified integrate-to-database.js to map モバイルアプリ to 'app' category
- Created temporary no-category version for immediate deployment
- Added comprehensive documentation for manual execution

Next steps:
- Run integrate-to-database-no-category.js to update database
- Add category column via Supabase dashboard
- Re-run with full category support

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. プッシュ
git push origin main
```

## デプロイ後の確認

Vercelでのデプロイが完了したら：

1. https://poisoku.jp にアクセス
2. 検索バーに「獅子の如く」と入力
3. 結果が表示されることを確認

## 注意事項

⚠️ **重要**: このデプロイ後も、手動でのデータベース更新が必要です：

1. `node scripts/pointincome/integrate-to-database-no-category.js` を実行
2. `node scripts/generate-search-data.js` を実行
3. 再度デプロイして最新のsearch-data.jsonを反映

これらのスクリプトは、Supabaseへの接続とデータ更新を行うため、ローカル環境での実行が必要です。