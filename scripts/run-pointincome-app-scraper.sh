#!/bin/bash

# ポイントインカム スマホアプリ案件完全版スクレイピング実行
echo "🎯 ポイントインカム アプリ案件完全版取得開始"
echo "========================================"
echo "対象: 18カテゴリ × 2OS = 36回取得"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"

# ログファイル名を生成
LOG_FILE="pointincome_app_full_$(date '+%Y%m%d_%H%M%S').log"

# scraperディレクトリに移動
cd /Users/kn/poisoku-web/scrapers/src/sites/pointincome

# nohupでバックグラウンド実行
nohup node PointIncomeFullAppScraper.js > "$LOG_FILE" 2>&1 &

# プロセスIDを記録
PID=$!
echo "プロセスID: $PID"
echo "ログファイル: $LOG_FILE"

echo ""
echo "📊 進捗確認コマンド:"
echo "tail -f $LOG_FILE"
echo ""
echo "🛑 停止コマンド:"
echo "kill $PID"
echo ""
echo "✅ バックグラウンドで実行中。約10-15分で完了予定。"