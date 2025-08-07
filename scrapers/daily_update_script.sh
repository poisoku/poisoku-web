#!/bin/bash

# ポイ速 ちょびリッチデータ日次更新スクリプト
# 実行: ./daily_update_script.sh

echo "🚀 ポイ速データ更新開始: $(date '+%Y-%m-%d %H:%M:%S')"
echo "="
echo ""

# 作業ディレクトリ設定
SCRAPERS_DIR="/Users/kn/poisoku-web/scrapers"
PROJECT_DIR="/Users/kn/poisoku-web"

# ログファイル設定
LOG_DIR="$SCRAPERS_DIR/logs"
LOG_FILE="$LOG_DIR/daily_update_$(date '+%Y%m%d_%H%M%S').log"
mkdir -p "$LOG_DIR"

# エラーハンドリング
set -e
trap 'echo "❌ エラーが発生しました。ログを確認してください: $LOG_FILE"' ERR

# ログ出力関数
log() {
    echo "$1" | tee -a "$LOG_FILE"
}

# Step 1: v3システムでデータ取得
log "📊 Step 1: ちょびリッチ全案件取得中..."
cd "$SCRAPERS_DIR"
node complete_chobirich_system_v3.js 2>&1 | tee -a "$LOG_FILE"

# 取得成功確認
if [ -f "data/chobirich_production_complete_v3.json" ]; then
    CAMPAIGN_COUNT=$(grep -o '"id"' data/chobirich_production_complete_v3.json | wc -l)
    log "✅ 案件取得成功: ${CAMPAIGN_COUNT}件"
else
    log "❌ データ取得に失敗しました"
    exit 1
fi

# Step 2: 検索用データに変換
log ""
log "🔄 Step 2: 検索用データ変換中..."
node convert_v3_to_search_data.js 2>&1 | tee -a "$LOG_FILE"

# Step 3: データ検証・修正
log ""
log "🔍 Step 3: データ検証・修正中..."
node validate_and_fix_point_data.js 2>&1 | tee -a "$LOG_FILE"

# Step 4: Git更新確認
log ""
log "📝 Step 4: 変更確認中..."
cd "$PROJECT_DIR"
if git diff --quiet public/search-data.json; then
    log "ℹ️ データに変更はありません"
else
    # Step 5: Vercelへデプロイ
    log ""
    log "🚀 Step 5: Vercelへデプロイ中..."
    
    # バックアップ作成
    cp public/search-data.json "public/search-data-backup-$(date '+%Y%m%d').json"
    
    # Git操作
    git add public/search-data.json
    git commit -m "chore: Update Chobirich campaign data $(date '+%Y-%m-%d')" 2>&1 | tee -a "$LOG_FILE"
    git push origin main 2>&1 | tee -a "$LOG_FILE"
    
    log "✅ デプロイ完了！5分後に本番環境に反映されます"
fi

# 完了報告
log ""
log "="
log "🎉 更新処理完了: $(date '+%Y-%m-%d %H:%M:%S')"
log "ログファイル: $LOG_FILE"

# 古いログファイルのクリーンアップ（30日以前）
find "$LOG_DIR" -name "daily_update_*.log" -mtime +30 -delete

exit 0