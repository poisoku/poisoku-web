const fs = require('fs').promises;
const path = require('path');

class DataAnalyzer {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.pointincomeDir = path.join(this.projectRoot, 'scripts', 'pointincome');
  }

  async analyzeCurrentData() {
    console.log('📊 現在のデータ分析');
    console.log('='.repeat(50));
    
    const report = {
      timestamp: new Date().toISOString(),
      dataFiles: {},
      verification: {}
    };

    // 1. ポイントインカムデータファイル確認
    console.log('\n📄 ポイントインカムデータファイル:');
    const dataFiles = [
      'pointincome_batch_final.json',
      'pointincome_mobile_batch_final.json'
    ];

    for (const file of dataFiles) {
      try {
        const filePath = path.join(this.pointincomeDir, file);
        const stats = await fs.stat(filePath);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        const fileInfo = {
          size: Math.round(stats.size / 1024),
          lastModified: stats.mtime.toISOString(),
          campaignCount: data.campaigns ? data.campaigns.length : 0,
          scrapedAt: data.scrapedAt,
          summary: data.summary
        };

        console.log(`  ${file}:`);
        console.log(`    サイズ: ${fileInfo.size}KB`);
        console.log(`    更新日時: ${stats.mtime.toLocaleString('ja-JP')}`);
        console.log(`    案件数: ${fileInfo.campaignCount}件`);
        console.log(`    スクレイピング日時: ${data.scrapedAt}`);
        
        if (data.summary) {
          console.log(`    概要:`, JSON.stringify(data.summary, null, 6));
        }

        report.dataFiles[file] = fileInfo;

        // 獅子の如く確認（モバイルファイルのみ）
        if (file.includes('mobile')) {
          const shishiCampaigns = data.campaigns.filter(c => 
            c.title && c.title.includes('獅子の如く')
          );
          console.log(`    🎯 獅子の如く: ${shishiCampaigns.length}件`);
          
          shishiCampaigns.forEach((campaign, index) => {
            console.log(`      ${index + 1}. ${campaign.title} (${campaign.device})`);
          });

          report.verification.shishiInMobile = {
            count: shishiCampaigns.length,
            campaigns: shishiCampaigns
          };
        }

      } catch (error) {
        console.log(`  ❌ ${file}: ${error.message}`);
        report.dataFiles[file] = { error: error.message };
      }
    }

    // 2. 検索データファイル確認
    console.log('\n🔍 検索データファイル:');
    try {
      const searchDataPath = path.join(this.projectRoot, 'public', 'search-data.json');
      const stats = await fs.stat(searchDataPath);
      const content = await fs.readFile(searchDataPath, 'utf8');
      const data = JSON.parse(content);

      console.log(`  search-data.json:`);
      console.log(`    サイズ: ${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB`);
      console.log(`    更新日時: ${stats.mtime.toLocaleString('ja-JP')}`);
      console.log(`    総案件数: ${data.campaigns.length}件`);

      // 獅子の如く確認
      const shishiCount = (content.match(/獅子の如く/g) || []).length;
      console.log(`    🎯 獅子の如く出現回数: ${shishiCount}回`);

      // ポイントインカム案件数
      const pointIncomeCount = data.campaigns.filter(c => 
        c.siteName === 'ポイントインカム'
      ).length;
      console.log(`    📊 ポイントインカム案件: ${pointIncomeCount}件`);

      // デバイス別統計
      const deviceStats = {};
      data.campaigns.forEach(campaign => {
        const device = campaign.device || 'Unknown';
        deviceStats[device] = (deviceStats[device] || 0) + 1;
      });

      console.log('    📱 デバイス別統計:');
      Object.entries(deviceStats).forEach(([device, count]) => {
        console.log(`      ${device}: ${count}件`);
      });

      report.verification.searchData = {
        totalCampaigns: data.campaigns.length,
        pointIncomeCampaigns: pointIncomeCount,
        shishiOccurrences: shishiCount,
        deviceStats: deviceStats,
        fileSize: Math.round(stats.size / 1024 / 1024 * 100) / 100,
        lastModified: stats.mtime.toISOString()
      };

    } catch (error) {
      console.log(`  ❌ search-data.json: ${error.message}`);
      report.verification.searchData = { error: error.message };
    }

    // 3. システム状態判定
    console.log('\n📋 システム状態判定:');
    
    const now = new Date();
    const daysSinceMainScraping = report.dataFiles['pointincome_batch_final.json']?.lastModified 
      ? Math.round((now - new Date(report.dataFiles['pointincome_batch_final.json'].lastModified)) / (1000 * 60 * 60 * 24))
      : null;
    
    const daysSinceMobileScraping = report.dataFiles['pointincome_mobile_batch_final.json']?.lastModified
      ? Math.round((now - new Date(report.dataFiles['pointincome_mobile_batch_final.json'].lastModified)) / (1000 * 60 * 60 * 24))
      : null;

    console.log(`  メインデータ: ${daysSinceMainScraping}日前更新`);
    console.log(`  モバイルデータ: ${daysSinceMobileScraping}日前更新`);

    let needsRescraping = false;
    let recommendations = [];

    if (daysSinceMainScraping > 3) {
      needsRescraping = true;
      recommendations.push('メインカテゴリの再スクレイピングを推奨');
    }

    if (daysSinceMobileScraping > 3) {
      needsRescraping = true;
      recommendations.push('モバイルアプリの再スクレイピングを推奨');
    }

    if (!report.verification.shishiInMobile?.count || report.verification.shishiInMobile.count < 2) {
      needsRescraping = true;
      recommendations.push('獅子の如くデータ不足 - モバイルスクレイピング要実行');
    }

    if (!report.verification.searchData?.shishiOccurrences || report.verification.searchData.shishiOccurrences < 5) {
      recommendations.push('検索データの再生成を推奨');
    }

    console.log(`\n🎯 推奨アクション:`);
    if (needsRescraping) {
      console.log('  ❌ 再スクレイピングが必要です');
      recommendations.forEach(rec => console.log(`    - ${rec}`));
    } else {
      console.log('  ✅ データは最新状態です');
    }

    report.systemStatus = {
      needsRescraping,
      recommendations,
      daysSinceMainScraping,
      daysSinceMobileScraping
    };

    // レポート保存
    await fs.writeFile(
      path.join(this.projectRoot, 'data-analysis-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 詳細レポート: data-analysis-report.json');
    return report;
  }
}

// 実行
const analyzer = new DataAnalyzer();
analyzer.analyzeCurrentData().catch(console.error);