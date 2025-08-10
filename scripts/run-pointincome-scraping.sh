#!/bin/bash

# ポイントインカム全83カテゴリスクレイピング本番実行スクリプト

echo "🎯 ポイントインカム スクレイピング実行"
echo "========================================"
echo "対象: 全83カテゴリ（ショッピング51 + サービス32）"
echo "予想時間: 約35-40分"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ログディレクトリ作成
LOG_DIR="/Users/kn/poisoku-web/logs"
mkdir -p "$LOG_DIR"

# ログファイル名を生成
LOG_FILE="$LOG_DIR/pointincome_$(date '+%Y%m%d_%H%M%S').log"

# scraperディレクトリに移動
cd /Users/kn/poisoku-web/scrapers/src/sites/pointincome

# 実行方法を選択
if [ "$1" = "--foreground" ]; then
    echo "📌 フォアグラウンドで実行します..."
    node PointIncomeOptimized.js 2>&1 | tee "$LOG_FILE"
else
    echo "📌 バックグラウンドで実行します..."
    nohup node PointIncomeOptimized.js > "$LOG_FILE" 2>&1 &
    PID=$!
    
    echo "プロセスID: $PID"
    echo "ログファイル: $LOG_FILE"
    echo ""
    echo "📊 進捗確認:"
    echo "tail -f $LOG_FILE"
    echo ""
    echo "📈 案件数確認:"
    echo "grep '取得数:' $LOG_FILE | tail -1"
    echo ""
    echo "🛑 停止（必要時）:"
    echo "kill $PID"
fi

echo ""
echo "✅ スクレイピングを開始しました"