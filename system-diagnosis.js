const fs = require('fs').promises;
const path = require('path');

class SystemDiagnosis {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.pointincomeDir = path.join(this.projectRoot, 'scripts', 'pointincome');
  }

  async checkSystemReadiness() {
    console.log('🔍 システム診断開始');
    console.log('='.repeat(50));
    
    const report = {
      timestamp: new Date().toISOString(),
      checks: []
    };
    
    // 1. ファイル存在確認
    await this.checkFiles(report);
    
    // 2. データ品質確認
    await this.checkDataQuality(report);
    
    // 3. システム設定確認
    await this.checkSystemConfig(report);
    
    // 4. 最新状況確認
    await this.checkCurrentStatus(report);
    
    console.log('\n📊 診断結果サマリー');
    console.log('-'.repeat(30));
    
    const passed = report.checks.filter(c => c.status === 'pass').length;
    const failed = report.checks.filter(c => c.status === 'fail').length;
    const warnings = report.checks.filter(c => c.status === 'warning').length;
    
    console.log(`✅ 正常: ${passed}件`);
    console.log(`⚠️ 警告: ${warnings}件`);
    console.log(`❌ 異常: ${failed}件`);
    
    if (failed === 0) {
      console.log('\n🎉 システムは本番運用可能な状態です！');
    } else {
      console.log('\n⚠️ 修正が必要な項目があります');
    }
    
    // レポート保存
    await fs.writeFile(
      path.join(this.projectRoot, 'system-diagnosis-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    return report;
  }
  
  async checkFiles(report) {
    console.log('\n📁 ファイル存在確認');
    
    const criticalFiles = [
      'scripts/pointincome/batch-scraper.js',
      'scripts/pointincome/batch-mobile-scraper.js',
      'scripts/pointincome/integrate-to-database.js',
      'scripts/generate-search-data.js'
    ];
    
    for (const file of criticalFiles) {
      try {
        const filePath = path.join(this.projectRoot, file);
        await fs.access(filePath);
        console.log(`✅ ${file}`);
        report.checks.push({
          category: 'files',
          item: file,
          status: 'pass',
          message: 'ファイル存在'
        });
      } catch (error) {
        console.log(`❌ ${file} - 存在しません`);
        report.checks.push({
          category: 'files',
          item: file,
          status: 'fail',
          message: 'ファイル不存在'
        });
      }
    }
  }
  
  async checkDataQuality(report) {
    console.log('\n📊 データ品質確認');
    
    const dataFiles = [
      'pointincome_batch_final.json',
      'pointincome_mobile_batch_final.json'
    ];
    
    for (const file of dataFiles) {
      try {
        const filePath = path.join(this.pointincomeDir, file);
        const stats = await fs.stat(filePath);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        const campaignCount = data.campaigns ? data.campaigns.length : 0;
        const fileSize = Math.round(stats.size / 1024);
        const lastModified = stats.mtime;
        const daysSinceUpdate = Math.round((Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`📄 ${file}:`);
        console.log(`  案件数: ${campaignCount}件`);
        console.log(`  ファイルサイズ: ${fileSize}KB`);
        console.log(`  最終更新: ${lastModified.toLocaleString('ja-JP')} (${daysSinceUpdate}日前)`);
        
        // データ品質判定
        let status = 'pass';
        let message = '良好';
        
        if (file.includes('batch_final') && campaignCount < 1000) {
          status = 'warning';
          message = '案件数が少ない可能性';
        } else if (file.includes('mobile') && campaignCount < 50) {
          status = 'warning';
          message = 'モバイル案件数が少ない可能性';
        } else if (daysSinceUpdate > 7) {
          status = 'warning';
          message = 'データが古い可能性';
        }
        
        if (daysSinceUpdate > 30) {
          status = 'fail';
          message = 'データが古すぎる - 再スクレイピング必要';
        }
        
        const statusIcon = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${statusIcon} ${message}`);
        
        report.checks.push({
          category: 'data_quality',
          item: file,
          status: status,
          message: message,
          details: { campaignCount, fileSize, daysSinceUpdate }
        });
        
        // 獅子の如くの確認（モバイルファイルのみ）
        if (file.includes('mobile')) {
          const shishiCount = data.campaigns.filter(c => c.title && c.title.includes('獅子の如く')).length;
          console.log(`  🎯 獅子の如く: ${shishiCount}件`);
          
          if (shishiCount >= 2) {
            console.log(`  ✅ 獅子の如く確認済み`);
            report.checks.push({
              category: 'data_quality',
              item: '獅子の如く',
              status: 'pass',
              message: `${shishiCount}件確認`,
              details: { count: shishiCount }
            });
          } else {
            console.log(`  ⚠️ 獅子の如くが不足`);
            report.checks.push({
              category: 'data_quality',
              item: '獅子の如く',
              status: 'warning',
              message: `${shishiCount}件のみ確認`,
              details: { count: shishiCount }
            });
          }
        }
        
      } catch (error) {
        console.log(`❌ ${file}: ${error.message}`);
        report.checks.push({
          category: 'data_quality',
          item: file,
          status: 'fail',
          message: error.message
        });
      }
    }
  }
  
  async checkSystemConfig(report) {
    console.log('\n⚙️ システム設定確認');
    
    try {
      // .env.localの確認
      const envPath = path.join(this.projectRoot, '.env.local');
      const envContent = await fs.readFile(envPath, 'utf8');
      
      const hasSupabaseUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL=');
      const hasSupabaseKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=');
      
      console.log(`✅ .env.local: 存在`);
      console.log(`${hasSupabaseUrl ? '✅' : '❌'} Supabase URL設定`);
      console.log(`${hasSupabaseKey ? '✅' : '❌'} Supabase Key設定`);
      
      report.checks.push({
        category: 'system_config',
        item: 'environment_variables',
        status: (hasSupabaseUrl && hasSupabaseKey) ? 'pass' : 'fail',
        message: '環境変数設定',
        details: { hasSupabaseUrl, hasSupabaseKey }
      });
      
    } catch (error) {
      console.log(`❌ .env.local: ${error.message}`);
      report.checks.push({
        category: 'system_config',
        item: 'environment_variables',
        status: 'fail',
        message: error.message
      });
    }
    
    // package.jsonの確認
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      const hasPuppeteer = packageContent.dependencies && packageContent.dependencies.puppeteer;
      const hasSupabase = packageContent.dependencies && packageContent.dependencies['@supabase/supabase-js'];
      
      console.log(`${hasPuppeteer ? '✅' : '❌'} Puppeteer依存関係`);
      console.log(`${hasSupabase ? '✅' : '❌'} Supabase依存関係`);
      
      report.checks.push({
        category: 'system_config',
        item: 'dependencies',
        status: (hasPuppeteer && hasSupabase) ? 'pass' : 'fail',
        message: '依存関係確認',
        details: { hasPuppeteer, hasSupabase }
      });
      
    } catch (error) {
      console.log(`❌ package.json: ${error.message}`);
    }
  }
  
  async checkCurrentStatus(report) {
    console.log('\n🔍 現在の状況確認');
    
    try {
      // search-data.jsonの確認
      const searchDataPath = path.join(this.projectRoot, 'public', 'search-data.json');
      const stats = await fs.stat(searchDataPath);
      const fileSize = Math.round(stats.size / 1024 / 1024 * 100) / 100;
      const lastModified = stats.mtime;
      const daysSinceUpdate = Math.round((Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`📄 search-data.json:`);
      console.log(`  ファイルサイズ: ${fileSize}MB`);
      console.log(`  最終更新: ${lastModified.toLocaleString('ja-JP')} (${daysSinceUpdate}日前)`);
      
      // ファイル内容の簡易チェック
      const content = await fs.readFile(searchDataPath, 'utf8');
      const hasShishi = content.includes('獅子の如く');
      const pointIncomeCount = (content.match(/"siteName": "ポイントインカム"/g) || []).length;
      
      console.log(`  🎯 獅子の如く: ${hasShishi ? '✅ 含まれている' : '❌ 含まれていない'}`);
      console.log(`  📊 ポイントインカム案件: ${pointIncomeCount}件`);
      
      let status = 'pass';
      let message = '最新状態';
      
      if (!hasShishi) {
        status = 'fail';
        message = '獅子の如くが含まれていない';
      } else if (pointIncomeCount < 1000) {
        status = 'warning';
        message = 'ポイントインカム案件数が少ない';
      } else if (daysSinceUpdate > 7) {
        status = 'warning';
        message = 'データが古い';
      }
      
      report.checks.push({
        category: 'current_status',
        item: 'search_data',
        status: status,
        message: message,
        details: { fileSize, daysSinceUpdate, hasShishi, pointIncomeCount }
      });
      
    } catch (error) {
      console.log(`❌ search-data.json: ${error.message}`);
      report.checks.push({
        category: 'current_status',
        item: 'search_data',
        status: 'fail',
        message: error.message
      });
    }
  }
}

// 実行
const diagnosis = new SystemDiagnosis();
diagnosis.checkSystemReadiness().catch(console.error);