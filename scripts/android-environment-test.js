const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * Android環境でのちょびリッチアクセス可能性調査
 */
class AndroidEnvironmentTester {
  constructor() {
    this.baseUrl = 'https://www.chobirich.com';
    this.testUrls = [
      '/smartphone?sort=point',
      '/smartphone?sort=point&page=2',
      '/smartphone?sort=point&page=3'
    ];
    
    // 複数のAndroid User Agentでテスト
    this.androidUserAgents = [
      // Google Pixel 7 (最新)
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      
      // Samsung Galaxy S23
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      
      // OnePlus 11
      'Mozilla/5.0 (Linux; Android 13; CPH2449) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
      
      // 汎用Android
      'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
    ];
    
    // 比較用iOS User Agent
    this.iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    
    this.results = {
      android: {},
      ios: null,
      comparison: {}
    };
  }

  async delay(seconds) {
    console.log(`⏳ ${seconds}秒待機中...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async testUserAgent(userAgent, deviceType, agentName) {
    console.log(`\n🧪 テスト開始: ${agentName}`);
    console.log(`User-Agent: ${userAgent.substring(0, 60)}...`);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const testResult = {
      userAgent: agentName,
      success: 0,
      failed: 0,
      campaigns: [],
      errors: [],
      accessStatus: {}
    };
    
    try {
      for (let i = 0; i < this.testUrls.length; i++) {
        const testUrl = this.testUrls[i];
        const fullUrl = `${this.baseUrl}${testUrl}`;
        
        console.log(`  📄 テスト ${i + 1}/3: ${testUrl}`);
        
        const page = await browser.newPage();
        
        try {
          await page.setUserAgent(userAgent);
          
          await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache'
          });
          
          // リソース最適化
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
              req.abort();
            } else {
              req.continue();
            }
          });
          
          const response = await page.goto(fullUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          const status = response.status();
          testResult.accessStatus[testUrl] = status;
          
          if (status === 200) {
            console.log(`    ✅ アクセス成功 (${status})`);
            testResult.success++;
            
            await this.delay(2);
            
            // 案件データを抽出
            const pageData = await page.evaluate((testUrl) => {
              const campaignLinks = document.querySelectorAll('a[href*="/ad_details/"]');
              const campaigns = [];
              
              campaignLinks.forEach(link => {
                const href = link.href;
                
                let campaignId = null;
                const directMatch = href.match(/\/ad_details\/(\d+)/);
                const redirectMatch = href.match(/\/ad_details\/redirect\/(\d+)/);
                
                if (directMatch) {
                  campaignId = directMatch[1];
                } else if (redirectMatch) {
                  campaignId = redirectMatch[1];
                }
                
                if (campaignId) {
                  const container = link.closest('div, li, article, section, tr');
                  let campaignName = '';
                  let cashback = '';
                  
                  if (container) {
                    const textContent = container.textContent || '';
                    
                    campaignName = link.textContent?.trim() || '';
                    if (!campaignName) {
                      const nearbyText = container.textContent.split('\n')[0]?.trim();
                      if (nearbyText && nearbyText.length < 100) {
                        campaignName = nearbyText;
                      }
                    }
                    
                    const pointMatch = textContent.match(/(\d+(?:,\d{3})*)\s*(?:pt|ポイント)/i);
                    if (pointMatch) {
                      cashback = pointMatch[1] + 'pt';
                    }
                    
                    if (!cashback) {
                      const percentMatch = textContent.match(/(\d+(?:\.\d+)?)\s*%/);
                      if (percentMatch) {
                        cashback = percentMatch[1] + '%';
                      }
                    }
                  }
                  
                  let device = 'all';
                  if (campaignName.includes('iOS') || campaignName.includes('iPhone')) {
                    device = 'ios';
                  } else if (campaignName.includes('Android')) {
                    device = 'android';
                  }
                  
                  if (campaignName && campaignName.length > 2) {
                    campaigns.push({
                      id: campaignId,
                      name: campaignName,
                      url: href,
                      cashback: cashback || '要確認',
                      device: device,
                      pageUrl: testUrl
                    });
                  }
                }
              });
              
              return {
                campaigns,
                totalLinks: campaignLinks.length,
                pageTitle: document.title,
                hasContent: document.body.innerText.length > 1000
              };
            }, testUrl);
            
            testResult.campaigns.push(...pageData.campaigns);
            console.log(`    📊 案件数: ${pageData.campaigns.length}件 (総リンク: ${pageData.totalLinks})`);
            
            // デバイス別集計
            const deviceCount = {};
            pageData.campaigns.forEach(c => {
              deviceCount[c.device] = (deviceCount[c.device] || 0) + 1;
            });
            
            if (Object.keys(deviceCount).length > 0) {
              console.log(`    📱 デバイス内訳: ${JSON.stringify(deviceCount)}`);
            }
            
          } else {
            console.log(`    ❌ アクセス失敗 (${status})`);
            testResult.failed++;
            testResult.errors.push(`${testUrl}: HTTP ${status}`);
          }
          
        } catch (error) {
          console.log(`    💥 エラー: ${error.message}`);
          testResult.failed++;
          testResult.errors.push(`${testUrl}: ${error.message}`);
          testResult.accessStatus[testUrl] = 'ERROR';
        } finally {
          await page.close();
        }
        
        await this.delay(3);
      }
      
    } finally {
      await browser.close();
    }
    
    return testResult;
  }

  async runTests() {
    console.log('🤖 Android環境アクセス可能性調査開始\n');
    console.log('='.repeat(80));
    console.log('目的: Android User AgentでちょびリッチからAndroid専用案件を取得可能か調査');
    console.log('対象: /smartphone ページ（アプリ案件）');
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    
    try {
      // 1. iOS環境でのベースライン取得
      console.log('\n📱 【ベースライン】iOS環境でのテスト');
      this.results.ios = await this.testUserAgent(
        this.iosUserAgent,
        'ios',
        'iOS Safari'
      );
      
      await this.delay(5);
      
      // 2. 複数のAndroid環境でテスト
      console.log('\n🤖 【メイン】Android環境でのテスト');
      
      for (let i = 0; i < this.androidUserAgents.length; i++) {
        const androidUA = this.androidUserAgents[i];
        const agentName = `Android-${i + 1}`;
        
        console.log(`\n--- Android環境 ${i + 1}/${this.androidUserAgents.length} ---`);
        
        this.results.android[agentName] = await this.testUserAgent(
          androidUA,
          'android',
          agentName
        );
        
        // 成功した場合は他のUAもテストする前に少し待機
        if (this.results.android[agentName].success > 0) {
          await this.delay(10);
        } else {
          await this.delay(5);
        }
      }
      
      // 3. 結果分析
      await this.analyzeResults();
      
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      
      console.log(`\n⏱️ 調査完了時間: ${duration}秒`);
      
    } catch (error) {
      console.error('💥 調査エラー:', error);
    }
  }

  async analyzeResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 調査結果分析');
    console.log('='.repeat(80));
    
    // iOS結果
    console.log('\n📱 iOS環境結果:');
    console.log(`  成功: ${this.results.ios.success}/3 ページ`);
    console.log(`  失敗: ${this.results.ios.failed}/3 ページ`);
    console.log(`  取得案件数: ${this.results.ios.campaigns.length}件`);
    
    if (this.results.ios.campaigns.length > 0) {
      const iosDeviceCount = {};
      this.results.ios.campaigns.forEach(c => {
        iosDeviceCount[c.device] = (iosDeviceCount[c.device] || 0) + 1;
      });
      console.log(`  デバイス内訳: ${JSON.stringify(iosDeviceCount)}`);
    }
    
    // Android結果
    console.log('\n🤖 Android環境結果:');
    
    let bestAndroidResult = null;
    let bestSuccessCount = 0;
    
    Object.entries(this.results.android).forEach(([agentName, result]) => {
      console.log(`\n  【${agentName}】`);
      console.log(`    成功: ${result.success}/3 ページ`);
      console.log(`    失敗: ${result.failed}/3 ページ`);
      console.log(`    取得案件数: ${result.campaigns.length}件`);
      
      if (result.errors.length > 0) {
        console.log(`    エラー: ${result.errors.join(', ')}`);
      }
      
      if (result.campaigns.length > 0) {
        const androidDeviceCount = {};
        result.campaigns.forEach(c => {
          androidDeviceCount[c.device] = (androidDeviceCount[c.device] || 0) + 1;
        });
        console.log(`    デバイス内訳: ${JSON.stringify(androidDeviceCount)}`);
        
        if (result.success > bestSuccessCount) {
          bestSuccessCount = result.success;
          bestAndroidResult = result;
        }
      }
    });
    
    // 比較分析
    console.log('\n📈 比較分析:');
    console.log('━'.repeat(60));
    
    if (bestAndroidResult && bestAndroidResult.campaigns.length > 0) {
      console.log('✅ Android環境でのアクセス成功！');
      console.log(`最良のAndroid UA: ${bestAndroidResult.userAgent}`);
      console.log(`iOS案件数: ${this.results.ios.campaigns.length}件`);
      console.log(`Android案件数: ${bestAndroidResult.campaigns.length}件`);
      
      // Android特有の案件を探す
      const androidSpecificCampaigns = bestAndroidResult.campaigns.filter(
        androidCampaign => !this.results.ios.campaigns.some(
          iosCampaign => iosCampaign.id === androidCampaign.id
        )
      );
      
      console.log(`Android専用案件: ${androidSpecificCampaigns.length}件`);
      
      if (androidSpecificCampaigns.length > 0) {
        console.log('\n🎯 Android専用案件例:');
        androidSpecificCampaigns.slice(0, 3).forEach((campaign, i) => {
          console.log(`${i + 1}. ID: ${campaign.id}`);
          console.log(`   名前: ${campaign.name.substring(0, 60)}...`);
          console.log(`   デバイス: ${campaign.device}`);
          console.log('');
        });
      }
      
      // 実装推奨案
      console.log('\n💡 実装推奨案:');
      console.log('━'.repeat(60));
      console.log('✅ デュアル環境スクレイピング実装可能');
      console.log(`✅ 最適Android UA: ${bestAndroidResult.userAgent}`);
      console.log('✅ iOS環境とAndroid環境で別々に取得');
      console.log('✅ 重複除去して統合（同名でも別案件として扱い）');
      
    } else {
      console.log('❌ Android環境でのアクセス失敗');
      console.log('原因: 403エラーまたは接続エラー');
      console.log('対策案:');
      console.log('1. より多様なAndroid User Agentでテスト');
      console.log('2. プロキシ経由でのアクセス');
      console.log('3. セッション管理の改善');
      console.log('4. アクセス間隔の調整');
    }
    
    // 結果保存
    const outputFile = 'android_environment_test_results.json';
    await fs.writeFile(outputFile, JSON.stringify({
      test_date: new Date().toISOString(),
      results: this.results,
      summary: {
        ios_success: this.results.ios.success > 0,
        android_success: bestAndroidResult ? bestAndroidResult.success > 0 : false,
        best_android_ua: bestAndroidResult ? bestAndroidResult.userAgent : null,
        dual_environment_feasible: bestAndroidResult ? bestAndroidResult.success > 0 : false
      }
    }, null, 2));
    
    console.log(`\n💾 詳細結果: ${outputFile}`);
  }
}

// 実行
if (require.main === module) {
  const tester = new AndroidEnvironmentTester();
  tester.runTests().catch(console.error);
}

module.exports = AndroidEnvironmentTester;