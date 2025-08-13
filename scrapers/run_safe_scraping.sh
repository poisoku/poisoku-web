#!/bin/bash

# ちょびリッチ確実な順次スクレイピングシステム【シェルスクリプト版】
# 403エラー対策：各システムを独立プロセスで実行し、確実な2分待機を実現

# 設定
SCRAPE_DIR="/Users/kn/poisoku-web/scrapers"
LOG_FILE="$SCRAPE_DIR/scraping.log"
WAIT_TIME=120          # システム間待機: 2分

# ログ関数
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a "$LOG_FILE"
}

# 進捗表示関数
show_progress() {
    local duration=$1
    local message=$2
    local start_time=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $duration ]; then
            break
        fi
        
        local remaining=$((duration - elapsed))
        printf "\r⏳ %s... 残り%d秒    " "$message" $remaining
        sleep 10
    done
    printf "\r✅ %s完了%*s\n" "$message" 20 ""
}

# システム実行関数
run_system() {
    local system_name="$1"
    local command="$2"
    local icon="$3"
    
    log "$icon $system_name 実行開始"
    echo ""
    echo "===================================================================================="
    echo "$icon $system_name スクレイピング開始"
    echo "===================================================================================="
    echo "📋 実行コマンド: $command"
    echo "⏱️  実行開始: $(date '+%H:%M:%S')"
    echo "📝 ログファイル: $LOG_FILE"
    echo "===================================================================================="
    
    # システム実行（macOS対応・シンプル版）
    cd "$SCRAPE_DIR"
    if eval "$command" 2>&1 | tee -a "$LOG_FILE"; then
        local exit_code=${PIPESTATUS[0]}
        
        if [ $exit_code -eq 0 ]; then
            log "$icon $system_name 正常完了"
            echo "✅ $system_name 正常完了"
            return 0
        else
            log "$icon $system_name エラー終了（exit code: $exit_code）"
            echo "❌ $system_name エラー終了（exit code: $exit_code）"
            return 1
        fi
    else
        log "$icon $system_name 実行失敗"
        echo "💥 $system_name 実行失敗"
        return 1
    fi
}

# 確実な待機関数
safe_wait() {
    local wait_seconds=$1
    local reason="$2"
    
    log "⏳ $reason のため${wait_seconds}秒待機開始"
    echo ""
    echo "🛡️ 403エラー対策: $reason"
    
    # プログレスバー付き待機
    show_progress $wait_seconds "$reason 待機中" &
    local progress_pid=$!
    
    sleep $wait_seconds
    
    # プログレスバー終了
    kill $progress_pid 2>/dev/null
    wait $progress_pid 2>/dev/null
    
    log "✅ ${wait_seconds}秒待機完了"
    echo ""
}

# メイン処理開始
main() {
    local start_time=$(date +%s)
    
    # ログファイル初期化
    echo "" > "$LOG_FILE"
    
    echo "🚀 ちょびリッチ確実な順次スクレイピングシステム【シェルスクリプト版】"
    echo "===================================================================================="
    echo "🛡️ 403エラー対策: 各システムを独立プロセスで実行"
    echo "⏱️  システム間待機: ${WAIT_TIME}秒"
    echo "📋 実行順序:"
    echo "   1. 拡張システム（全20カテゴリ） → ${WAIT_TIME}秒待機"
    echo "   2. iOS案件スクレイピング → ${WAIT_TIME}秒待機"  
    echo "   3. Android案件スクレイピング"
    echo "📁 作業ディレクトリ: $SCRAPE_DIR"
    echo "📝 ログファイル: $LOG_FILE"
    echo "===================================================================================="
    
    log "🚀 確実な順次スクレイピング開始"
    
    # Step 1: 拡張システム実行
    if run_system "拡張システム" "node main_extended.js all" "🛍️"; then
        EXTENDED_SUCCESS=true
    else
        EXTENDED_SUCCESS=false
    fi
    
    # Step 2: 確実な2分待機
    safe_wait $WAIT_TIME "iOS案件スクレイピング前の403エラー対策"
    
    # Step 3: iOS案件実行
    if run_system "iOS案件スクレイピング" "node main_mobile_app.js ios" "📱"; then
        IOS_SUCCESS=true
    else
        IOS_SUCCESS=false
    fi
    
    # Step 4: 確実な2分待機
    safe_wait $WAIT_TIME "Android案件スクレイピング前の403エラー対策"
    
    # Step 5: Android案件実行
    if run_system "Android案件スクレイピング" "node main_mobile_app.js android" "🤖"; then
        ANDROID_SUCCESS=true
    else
        ANDROID_SUCCESS=false
    fi
    
    # 最終レポート生成
    generate_final_report $start_time
}

# 最終レポート生成
generate_final_report() {
    local start_time=$1
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local hours=$((total_duration / 3600))
    local minutes=$(((total_duration % 3600) / 60))
    local seconds=$((total_duration % 60))
    
    echo ""
    echo "===================================================================================="
    echo "📊 確実な順次スクレイピング完了レポート"
    echo "===================================================================================="
    printf "⏱️  総実行時間: %02d時間%02d分%02d秒\n" $hours $minutes $seconds
    echo ""
    
    # システム別結果
    echo "📋 システム別実行結果:"
    if [ "$EXTENDED_SUCCESS" = true ]; then
        echo "   🛍️  拡張システム: ✅ 成功"
    else
        echo "   🛍️  拡張システム: ❌ 失敗/タイムアウト"
    fi
    
    if [ "$IOS_SUCCESS" = true ]; then
        echo "   📱 iOS案件: ✅ 成功"
    else
        echo "   📱 iOS案件: ❌ 失敗/タイムアウト"
    fi
    
    if [ "$ANDROID_SUCCESS" = true ]; then
        echo "   🤖 Android案件: ✅ 成功"
    else
        echo "   🤖 Android案件: ❌ 失敗/タイムアウト"
    fi
    
    # 成功率計算
    local success_count=0
    [ "$EXTENDED_SUCCESS" = true ] && success_count=$((success_count + 1))
    [ "$IOS_SUCCESS" = true ] && success_count=$((success_count + 1))
    [ "$ANDROID_SUCCESS" = true ] && success_count=$((success_count + 1))
    
    local success_rate=$((success_count * 100 / 3))
    echo ""
    echo "📊 システム成功率: ${success_rate}% (${success_count}/3)"
    
    # 最新ファイル確認
    echo ""
    echo "📁 生成されたファイル:"
    find "$SCRAPE_DIR" -name "chobirich_*_$(date '+%Y-%m-%d')*.json" -exec basename {} \; 2>/dev/null | head -5 | while read file; do
        echo "   📄 $file"
    done
    
    # 成功メッセージ
    if [ $success_rate -eq 100 ]; then
        echo ""
        echo "🎉 全システムで403エラーを完全回避！確実な順次実行の成功！"
    elif [ $success_rate -ge 67 ]; then
        echo ""
        echo "🎊 大部分のシステムで成功！403エラー対策が効果的です。"
    else
        echo ""
        echo "⚠️ 複数のシステムで問題が発生しました。ログを確認してください。"
    fi
    
    echo ""
    echo "📝 詳細ログ: $LOG_FILE"
    echo "✅ 確実な順次スクレイピング完了"
    
    log "📊 最終結果: 成功率${success_rate}% (${success_count}/3)"
    log "✅ 確実な順次スクレイピング完了"
}

# エラーハンドリング
trap 'echo ""; log "💥 スクリプト中断"; exit 1' INT TERM

# 作業ディレクトリに移動
cd "$SCRAPE_DIR" || {
    echo "❌ 作業ディレクトリに移動できません: $SCRAPE_DIR"
    exit 1
}

# メイン処理実行
main "$@"