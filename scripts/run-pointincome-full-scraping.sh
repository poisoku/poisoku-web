#!/bin/bash

# ポイントインカム全83カテゴリスクレイピング実行スクリプト
# 実行時間制限を回避するためnohupでバックグラウンド実行

echo "🎯 ポイントインカム全83カテゴリスクレイピングを開始します"
echo "========================================"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"

# ログファイル名を生成
LOG_FILE="pointincome_full_scraping_$(date '+%Y%m%d_%H%M%S').log"

# scraperディレクトリに移動
cd /Users/kn/poisoku-web/scrapers/src/sites/pointincome

# nohupでバックグラウンド実行
nohup node PointIncomeMobileComplete.js > "$LOG_FILE" 2>&1 &

# プロセスIDを記録
PID=$!
echo "プロセスID: $PID"
echo "ログファイル: $LOG_FILE"

# 進捗確認コマンドを表示
echo ""
echo "📊 進捗確認コマンド:"
echo "tail -f $LOG_FILE"
echo ""
echo "🛑 停止コマンド:"
echo "kill $PID"
echo ""
echo "✅ バックグラウンドで実行中です。約30-40分で完了予定です。"