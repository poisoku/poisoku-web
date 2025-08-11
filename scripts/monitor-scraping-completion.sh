#!/bin/bash

# スクレイピング完了監視スクリプト
LOG_FILE="/Users/kn/poisoku-web/scrapers/src/sites/pointincome/pointincome_full_scraping_20250810_170816.log"
DATA_DIR="/Users/kn/poisoku-web/scrapers/data/pointincome"

echo "📊 ポイントインカムスクレイピング完了監視"
echo "========================================="

while true; do
    # 最新の進捗を確認
    PROGRESS=$(tail -100 "$LOG_FILE" | grep "進捗:" | tail -1)
    
    # 完了レポートの存在確認
    if grep -q "モバイル版完全取得完了レポート" "$LOG_FILE"; then
        echo ""
        echo "✅ スクレイピング完了！"
        echo ""
        
        # 完了レポートを表示
        tail -50 "$LOG_FILE" | grep -A 50 "モバイル版完全取得完了レポート"
        
        # 最新のJSONファイルを探す
        LATEST_JSON=$(ls -t "$DATA_DIR"/pointincome_mobile_complete_*.json 2>/dev/null | head -1)
        
        if [ -n "$LATEST_JSON" ]; then
            echo ""
            echo "💾 生成されたファイル: $LATEST_JSON"
            
            # 案件数を確認
            CAMPAIGN_COUNT=$(grep -o '"id":' "$LATEST_JSON" | wc -l)
            echo "📊 取得案件数: $CAMPAIGN_COUNT 件"
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
    
    sleep 10
done

echo ""
echo "監視終了"