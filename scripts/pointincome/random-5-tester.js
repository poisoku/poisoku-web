const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class Random5Tester {
  constructor() {
    this.baseUrl = 'https://pointi.jp';
    this.results = [];
    this.browser = null;
    
    // 5件のランダム案件をテスト（異なるカテゴリから選択）
    this.testUrls = [
      'https://pointi.jp/ad/153049/', // もち麦バースターターセット (EC)
      'https://pointi.jp/ad/146956/', // AliExpress (ファッション)
      'https://pointi.jp/ad/6475/',   // マクロミル (サービス)
      'https://pointi.jp/ad/151070/', // FISS (美容)
      'https://pointi.jp/ad/149139/', // SHEIN (ファッション)
    ];
  }

  async init() {
    console.log('🎯 ポイントインカム 5件ランダムテスト開始');
    console.log(`📊 テスト案件: ${this.testUrls.length}件`);
    console.log('🔍 改良版cashback抽出ロジック適用\n');
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ ブラウザ初期化完了');
  }

  async setupPage() {
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return page;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeCampaignDetail(url) {
    const page = await this.setupPage();
    
    try {
      console.log(`\n🔍 詳細スクレイピング: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.sleep(1000);
      
      const detailData = await page.evaluate(() => {
        // タイトル取得
        let title = '';
        const titleSelectors = ['h1', '.ad-title', '.campaign-title', '.title', 'h2', 'h3'];
        
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              element.textContent.trim() !== 'TOP' && 
              element.textContent.trim().length > 3) {
            title = element.textContent.trim();
            break;
          }
        }
        
        if (!title) {
          const titleElement = document.querySelector('title');
          if (titleElement) {
            const titleText = titleElement.textContent.trim();
            if (titleText && !titleText.includes('TOP') && !titleText.includes('ポイントサイト')) {
              title = titleText.split('|')[0].trim();
            }
          }
        }
        
        // 改良版還元率取得ロジック（timeout-free-scraperから移植）
        let cashback = '';
        let cashbackYen = '';
        let debugInfo = {
          foundPercentages: [],
          foundPoints: [],
          foundYen: [],
          strategy: ''
        };
        
        const allText = document.body.textContent;
        
        // 1. すべてのパーセント表記を検索
        const percentMatches = allText.match(/(\d+(?:\.\d+)?)\s*%/g);
        if (percentMatches) {
          debugInfo.foundPercentages = percentMatches.slice(0, 10); // 最初の10個まで
        }
        
        // 2. すべてのポイント表記を検索（大きな数字を優先）
        const pointMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*pt/g);
        if (pointMatches) {
          debugInfo.foundPoints = pointMatches.slice(0, 10); // 最初の10個まで
        }
        
        // 3. すべての円表記を検索
        const yenMatches = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*円/g);
        if (yenMatches) {
          debugInfo.foundYen = yenMatches.slice(0, 10); // 最初の10個まで
        }
        
        // 戦略A0: 矢印表記での特別還元率（最優先）
        const arrowPercentMatch = allText.match(/(\d+(?:\.\d+)?)\s*%[^0-9]*(?:⇒|→)[^0-9]*(\d+(?:\.\d+)?)\s*%/);
        if (arrowPercentMatch) {
          // 矢印の後の値を採用（特別還元率）
          cashback = arrowPercentMatch[2] + '%';
          debugInfo.strategy = 'arrow_percentage';
        }
        
        // 戦略A: 「購入金額の◯%」形式をチェック
        if (!cashback) {
          const purchasePercentMatch = allText.match(/購入金額の\s*(\d+(?:\.\d+)?)\s*%/);
          if (purchasePercentMatch) {
            cashback = purchasePercentMatch[1] + '%';
            debugInfo.strategy = 'purchase_percentage';
          }
        }
        
        // 戦略B: 固定ポイント案件かチェック（特定のコンテキストで抽出）
        if (!cashback && pointMatches) {
          let selectedPoints = 0;
          let bestPointMatch = '';
          let extractionMethod = '';
          
          // 方法1: 還元や獲得という文脈の近くにあるポイントを優先
          const contextualPatterns = [
            /還元[^\d]*?(\d{1,3}(?:,\d{3})*)\s*pt/,
            /獲得[^\d]*?(\d{1,3}(?:,\d{3})*)\s*pt/,
            /\b(\d{1,3}(?:,\d{3})*)\s*pt\s*(?:還元|獲得)/,
            /\b(\d{1,3}(?:,\d{3})*)\s*pt\s*(?:プレゼント|もらえる)/
          ];
          
          for (const pattern of contextualPatterns) {
            const match = allText.match(pattern);
            if (match && match[1]) {
              const pointValue = parseInt(match[1].replace(/,/g, ''));
              if (pointValue >= 1000 && pointValue > selectedPoints) {
                selectedPoints = pointValue;
                bestPointMatch = match[1] + 'pt';
                extractionMethod = 'contextual';
                break;
              }
            }
          }
          
          // 方法2: コンテキストで見つからない場合、頻出するポイント数を特定
          if (!bestPointMatch) {
            const pointCounts = {};
            for (const match of pointMatches) {
              const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
              if (pointValue >= 1000 && pointValue <= 50000) {
                pointCounts[pointValue] = (pointCounts[pointValue] || 0) + 1;
              }
            }
            
            // 最も頻出するポイント数を選択（複数回言及されるものは重要な可能性が高い）
            let maxCount = 0;
            let mostFrequentPoint = 0;
            for (const [points, count] of Object.entries(pointCounts)) {
              const pointValue = parseInt(points);
              if (count > maxCount || (count === maxCount && pointValue < mostFrequentPoint)) {
                maxCount = count;
                mostFrequentPoint = pointValue;
              }
            }
            
            if (mostFrequentPoint > 0) {
              selectedPoints = mostFrequentPoint;
              bestPointMatch = mostFrequentPoint.toLocaleString() + 'pt';
              extractionMethod = 'frequency';
            }
          }
          
          // 方法3: どちらでも見つからない場合、中程度のポイント数を選択（過度に大きくない値）
          if (!bestPointMatch) {
            const reasonablePoints = pointMatches
              .map(match => parseInt(match.replace(/[,pt\s]/g, '')))
              .filter(points => points >= 1000 && points <= 30000)
              .sort((a, b) => a - b);
            
            if (reasonablePoints.length > 0) {
              // 中央値付近を選択
              const midIndex = Math.floor(reasonablePoints.length / 2);
              selectedPoints = reasonablePoints[midIndex];
              bestPointMatch = selectedPoints.toLocaleString() + 'pt';
              extractionMethod = 'median';
            }
          }
          
          if (bestPointMatch) {
            cashback = bestPointMatch;
            const yenValue = Math.floor(selectedPoints / 10);
            cashbackYen = yenValue + '円';
            debugInfo.strategy = 'fixed_points_large';
            debugInfo.extractionMethod = extractionMethod;
          }
        }
        
        // 戦略C: 小さなポイント案件（1000pt未満）
        if (!cashback && pointMatches) {
          let maxPoints = 0;
          let bestPointMatch = '';
          
          for (const match of pointMatches) {
            const pointValue = parseInt(match.replace(/[,pt\s]/g, ''));
            if (pointValue > maxPoints) {
              maxPoints = pointValue;
              bestPointMatch = match.trim();
            }
          }
          
          if (bestPointMatch) {
            cashback = bestPointMatch;
            // 10pt = 1円でレート変換
            const yenValue = Math.floor(maxPoints / 10);
            if (yenValue > 0) {
              cashbackYen = yenValue + '円';
            }
            debugInfo.strategy = 'fixed_points_small';
          }
        }
        
        // 戦略D: パーセント形式（購入金額のパーセントでない場合）
        if (!cashback && percentMatches) {
          // 最初に見つかったパーセントを使用（広告メインエリアの可能性が高い）
          const firstPercent = percentMatches[0];
          const percentValue = parseFloat(firstPercent.replace('%', ''));
          if (percentValue > 0 && percentValue <= 100) {
            cashback = firstPercent;
            debugInfo.strategy = 'general_percentage';
          }
        }
        
        // 獲得条件は不要のため削除
        
        // デバイス情報（PC環境で確認できる案件は「すべて」に分類）
        let device = 'すべて';
        const titleLower = title.toLowerCase();
        const allTextLower = allText.toLowerCase();
        
        // iOSアプリ専用案件のみ「iOS」に分類
        if ((titleLower.includes('ios') || titleLower.includes('iphone') || titleLower.includes('ipad') || 
             titleLower.includes('app store') || allTextLower.includes('app store')) &&
            !titleLower.includes('android') && !titleLower.includes('pc')) {
          device = 'iOS';
        }
        // Androidアプリ専用案件のみ「Android」に分類
        else if ((titleLower.includes('android') || titleLower.includes('google play') || 
                  titleLower.includes('アンドロイド')) &&
                 !titleLower.includes('ios') && !titleLower.includes('pc')) {
          device = 'Android';
        }
        // その他すべて（Webサイト、両対応アプリ、PC専用等）は「すべて」
        
        return {
          title: title || 'タイトル取得失敗',
          cashback: cashback,
          cashbackYen: cashbackYen,
          device: device,
          scrapedAt: new Date().toISOString(),
          debugInfo: debugInfo
        };
      });
      
      const urlParts = url.split('/');
      const adId = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      // デバッグ情報を表示
      console.log(`   📊 発見した％: ${detailData.debugInfo.foundPercentages.slice(0,3).join(', ') || 'なし'}`);
      console.log(`   📊 発見したpt: ${detailData.debugInfo.foundPoints.slice(0,3).join(', ') || 'なし'}`);
      console.log(`   📊 戦略: ${detailData.debugInfo.strategy} ${detailData.debugInfo.extractionMethod ? '(' + detailData.debugInfo.extractionMethod + ')' : ''}`);
      console.log(`   ✅ 採用した還元: ${detailData.cashback || '不明'} ${detailData.cashbackYen ? '(' + detailData.cashbackYen + ')' : ''}`);
      console.log(`   📱 デバイス: ${detailData.device}`);
      
      return {
        id: `pi_${adId}`,
        url: url,
        campaignUrl: url,
        displayName: detailData.title,
        ...detailData
      };
      
    } finally {
      await page.close();
    }
  }

  async run() {
    try {
      await this.init();
      
      for (let i = 0; i < this.testUrls.length; i++) {
        const url = this.testUrls[i];
        try {
          console.log(`\n[${i + 1}/${this.testUrls.length}] テスト開始`);
          const result = await this.scrapeCampaignDetail(url);
          this.results.push(result);
          await this.sleep(2000); // 2秒待機
        } catch (error) {
          console.error(`❌ エラー: ${url} - ${error.message}`);
        }
      }
      
      // 結果保存
      const output = {
        testType: 'random_5_campaign_test',
        testDate: new Date().toISOString(),
        summary: {
          total_tested: this.results.length,
          success_rate: `${this.results.length}/${this.testUrls.length}`
        },
        results: this.results
      };
      
      await fs.writeFile('random_5_test_results.json', JSON.stringify(output, null, 2));
      
      console.log('\n🎉 5件ランダムテスト完了！');
      console.log(`📊 成功数: ${this.results.length}/${this.testUrls.length}件`);
      console.log('📄 結果保存: random_5_test_results.json');
      
      // 結果サマリー
      console.log('\n📋 取得データサマリー:');
      this.results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title}`);
        console.log(`   💰 還元: ${result.cashback || '不明'} ${result.cashbackYen ? '(' + result.cashbackYen + ')' : ''}`);
        console.log(`   📱 デバイス: ${result.device}`);
        console.log(`   🔧 戦略: ${result.debugInfo.strategy}`);
        console.log(`   🔗 URL: ${result.url}`);
      });
      
      return output;
      
    } catch (error) {
      console.error('❌ テスト実行エラー:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// 実行
(async () => {
  const tester = new Random5Tester();
  await tester.run();
})();