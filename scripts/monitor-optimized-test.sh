#!/bin/bash

# 最適化版テストの完了監視
LOG_FILE="/Users/kn/poisoku-web/scrapers/src/sites/pointincome/pointincome_optimized_test_20250810_191937.log"
TARGET_COUNT=2667

echo "📊 最適化版テスト監視 (目標: ${TARGET_COUNT}件)"
echo "==============================================="

while true; do
    # 最新の進捗を取得
    PROGRESS=$(tail -50 "$LOG_FILE" | grep "進捗:" | tail -1)
    
    # 完了レポートの確認
    if grep -q "完了レポート" "$LOG_FILE"; then
        echo ""
        echo "✅ テスト完了！"
        
        # 結果レポートを表示
        tail -30 "$LOG_FILE" | grep -A 30 "完了レポート"
        
        # 案件数を確認
        FINAL_COUNT=$(grep "取得案件数:" "$LOG_FILE" | tail -1 | grep -o '[0-9]\+')
        
        echo ""
        if [ "$FINAL_COUNT" -eq "$TARGET_COUNT" ]; then
            echo "🎉 SUCCESS: $FINAL_COUNT 件取得 (目標: $TARGET_COUNT 件)"
            echo "最適化版は正常に動作しています！"
        elif [ "$FINAL_COUNT" -gt 2600 ]; then
            echo "✅ GOOD: $FINAL_COUNT 件取得 (目標: $TARGET_COUNT 件)"
            echo "許容範囲内です。最適化版は正常動作。"
        else
            echo "⚠️ WARNING: $FINAL_COUNT 件取得 (目標: $TARGET_COUNT 件)"
            echo "取得数が不足している可能性があります。"
        fi
        
        break
    fi
    
    # エラーチェック
    if grep -q "致命的エラー" "$LOG_FILE"; then
        echo ""
        echo "❌ エラーが発生しました"
        tail -20 "$LOG_FILE"
        break
    fi
    
    # 進捗表示
    if [ -n "$PROGRESS" ]; then
        echo -ne "\r$PROGRESS"
    fi
    
    sleep 15
done

echo ""
echo "監視終了"