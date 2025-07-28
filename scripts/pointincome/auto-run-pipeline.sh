#!/bin/bash

# ポイ速完全自動パイプライン実行スクリプト
# 手動介入なしで全カテゴリを自動処理

echo "🚀 ポイ速完全自動パイプライン開始"
echo "📊 タイムアウト制限を克服した完全自動実行"
echo "⏱️ 推定実行時間: 60-120分"
echo "🔄 5分毎に自動再実行"
echo "============================================================"

# 実行回数カウンター
execution_count=0
max_executions=50  # 最大実行回数（安全装置）

# 開始時刻記録
start_time=$(date +%s)

# 進捗ファイルのパス
progress_file="complete_scraping_progress.json"

# 完了チェック関数
check_completion() {
    if [[ -f "$progress_file" ]]; then
        completed_categories=$(jq -r '.completedCategories | length' "$progress_file" 2>/dev/null || echo "0")
        total_categories=39
        
        if [[ "$completed_categories" -ge "$total_categories" ]]; then
            echo "🎉 全カテゴリ完了！ ($completed_categories/$total_categories)"
            return 0
        else
            echo "📊 進捗: $completed_categories/$total_categories カテゴリ完了 ($(( completed_categories * 100 / total_categories ))%)"
            return 1
        fi
    else
        echo "📊 進捗: 0/39 カテゴリ完了 (0%)"
        return 1
    fi
}

# メイン実行ループ
while [[ $execution_count -lt $max_executions ]]; do
    execution_count=$((execution_count + 1))
    current_time=$(date +%s)
    elapsed_minutes=$(( (current_time - start_time) / 60 ))
    
    echo ""
    echo "📍 実行ラウンド $execution_count/$max_executions"
    echo "⏱️ 経過時間: ${elapsed_minutes}分"
    echo "🔄 パイプライン実行中..."
    
    # 完了チェック
    if check_completion; then
        break
    fi
    
    # パイプライン実行
    node run-complete-pipeline.js
    
    # 実行後の完了チェック
    if check_completion; then
        break
    fi
    
    # 次回実行までの待機
    echo "⏸️ 5秒待機後に自動再実行..."
    sleep 5
done

# 最終結果の確認
echo ""
echo "============================================================"
echo "🎯 完全自動パイプライン実行完了"

final_time=$(date +%s)
total_minutes=$(( (final_time - start_time) / 60 ))

echo "⏱️ 総実行時間: ${total_minutes}分"
echo "🔄 実行ラウンド数: $execution_count回"

# 最終進捗確認
if check_completion; then
    echo "✅ 全カテゴリ処理完了！"
    
    # 最終ファイルの確認
    if [[ -f "pointincome_complete_all_campaigns.json" ]]; then
        campaign_count=$(jq -r '.campaigns | length' "pointincome_complete_all_campaigns.json" 2>/dev/null || echo "不明")
        echo "📊 取得案件数: ${campaign_count}件"
    fi
    
    echo "🎉 ポイ速サイトに全データが反映されました！"
    
else
    echo "⚠️ 最大実行回数に達しました"
    echo "📊 現在の進捗を確認してください"
fi

echo "============================================================"