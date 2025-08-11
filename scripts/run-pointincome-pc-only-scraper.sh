#!/bin/bash

# ポイントインカム PC限定案件スクレイピング実行
echo "🖥️ ポイントインカム PC限定案件取得開始"
echo "=========================================="
echo "対象: カテゴリ270（ブラウザゲーム）"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"

# ログファイル名を生成
LOG_FILE="pointincome_pc_only_$(date '+%Y%m%d_%H%M%S').log"

# scraperディレクトリに移動
cd /Users/kn/poisoku-web/scrapers/src/sites/pointincome

# nohupでバックグラウンド実行
nohup node PointIncomePCOnlyScraper.js > "$LOG_FILE" 2>&1 &

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
echo "✅ バックグラウンドで実行中。約1-2分で完了予定。"