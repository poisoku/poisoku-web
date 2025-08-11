#!/bin/bash

# 最適化版スクレイパーのテスト実行
echo "🧪 最適化版ポイントインカムスクレイパーテスト開始"
echo "========================================"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"

# ログファイル名を生成
LOG_FILE="pointincome_optimized_test_$(date '+%Y%m%d_%H%M%S').log"

# scraperディレクトリに移動
cd /Users/kn/poisoku-web/scrapers/src/sites/pointincome

# nohupでバックグラウンド実行
nohup node PointIncomeOptimized.js > "$LOG_FILE" 2>&1 &

# プロセスIDを記録
PID=$!
echo "プロセスID: $PID"
echo "ログファイル: $LOG_FILE"

echo ""
echo "📊 進捗確認コマンド:"
echo "tail -f $LOG_FILE"
echo ""
echo "📈 案件数確認:"
echo "grep '取得数:' $LOG_FILE | tail -1"
echo ""
echo "🛑 停止コマンド:"
echo "kill $PID"
echo ""
echo "✅ 最適化版テスト実行中。目標: 2,667件取得"