#!/bin/bash

# ポイントインカムデータの統合と検索データの再生成を行うスクリプト

echo "🚀 ポイントインカムデータ統合プロセス開始"
echo "=================================="

# 作業ディレクトリに移動
cd /Users/kn/poisoku-web

# 1. データベース統合（categoryカラムなしバージョン）
echo ""
echo "📊 ステップ1: データベース統合"
echo "----------------------------------"
cd scripts/pointincome
node integrate-to-database-no-category.js

if [ $? -eq 0 ]; then
    echo "✅ データベース統合完了"
else
    echo "❌ データベース統合エラー"
    exit 1
fi

# 2. 検索データ再生成
echo ""
echo "🔍 ステップ2: 検索データ再生成"
echo "----------------------------------"
cd ../..
node scripts/generate-search-data.js

if [ $? -eq 0 ]; then
    echo "✅ 検索データ再生成完了"
else
    echo "❌ 検索データ再生成エラー"
    exit 1
fi

# 3. 結果確認
echo ""
echo "📋 ステップ3: 結果確認"
echo "----------------------------------"

# 獅子の如くが含まれているか確認
echo "🎯 獅子の如くの検索:"
grep -n "獅子の如く" public/search-data.json | head -5

# ポイントインカムのモバイルアプリ案件を確認
echo ""
echo "📱 ポイントインカムのiOS/Android案件数:"
grep -c '"siteName": "ポイントインカム".*"device": "iOS"' public/search-data.json
grep -c '"siteName": "ポイントインカム".*"device": "Android"' public/search-data.json

# ファイルサイズ確認
echo ""
echo "📏 search-data.jsonのファイルサイズ:"
ls -lh public/search-data.json

echo ""
echo "=================================="
echo "🎉 すべてのプロセスが完了しました"
echo ""
echo "次のステップ:"
echo "1. Supabaseダッシュボードでadd_category_column.sqlを実行"
echo "2. その後、integrate-to-database.js（categoryあり版）を実行"
echo "3. git add . && git commit -m 'Fix mobile app integration' && git push"