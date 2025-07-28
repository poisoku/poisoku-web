const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ProductionScrapingRunner {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.pointincomeDir = path.join(this.projectRoot, 'scripts', 'pointincome');
  }

  async runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
      console.log(`\n🚀 実行開始: ${command} ${args.join(' ')}`);
      console.log(`📁 ディレクトリ: ${cwd}`);
      console.log(`⏰ 開始時間: ${new Date().toLocaleString('ja-JP')}`);
      
      const startTime = Date.now();
      const child = spawn(command, args, { 
        cwd, 
        stdio: 'pipe',
        shell: true 
      });
      
      let output = '';
      let errorOutput = '';
      
      child.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // リアルタイムで重要な情報を表示
        if (text.includes('✅') || text.includes('❌') || text.includes('📊') || text.includes('🎉')) {
          process.stdout.write(text);
        }
      });
      
      child.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });
      
      child.on('close', (code) => {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`\n⏱️ 実行時間: ${duration}秒`);
        console.log(`⏰ 終了時間: ${new Date().toLocaleString('ja-JP')}`);
        
        if (code === 0) {
          console.log(`✅ 成功: ${command} ${args.join(' ')}`);
          resolve({ output, errorOutput, duration });
        } else {
          console.error(`❌ 失敗: ${command} ${args.join(' ')} (終了コード: ${code})`);
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      child.on('error', (error) => {
        console.error(`❌ 実行エラー: ${error.message}`);
        reject(error);
      });
    });
  }

  async checkPreviousData() {
    console.log('📋 既存データの確認...');
    
    try {
      // 既存のスクレイピングデータをチェック
      const files = [
        'pointincome_batch_final.json',
        'pointincome_mobile_batch_final.json'
      ];
      
      for (const file of files) {
        try {
          const filePath = path.join(this.pointincomeDir, file);
          const stats = await fs.stat(filePath);
          const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
          
          console.log(`📄 ${file}:`);
          console.log(`  サイズ: ${Math.round(stats.size / 1024)}KB`);
          console.log(`  更新日時: ${stats.mtime.toLocaleString('ja-JP')}`);
          
          if (data.campaigns) {
            console.log(`  案件数: ${data.campaigns.length}件`);
          }
          
          if (data.summary) {
            console.log(`  概要: ${JSON.stringify(data.summary, null, 2)}`);
          }
        } catch (error) {
          console.log(`⚠️ ${file}: 存在しない`);
        }
      }
    } catch (error) {
      console.error('データ確認エラー:', error.message);
    }
  }

  async runProductionScraping() {
    console.log('🎯 本番環境スクレイピング実行');
    console.log('='.repeat(60));
    
    const results = {
      startTime: new Date().toISOString(),
      steps: []
    };
    
    try {
      // 0. 既存データ確認
      await this.checkPreviousData();
      
      // 1. メインカテゴリのスクレイピング
      console.log('\n🛍️ ステップ1: メインカテゴリスクレイピング');
      console.log('-'.repeat(50));
      
      const mainResult = await this.runCommand('node', ['batch-scraper.js'], this.pointincomeDir);
      results.steps.push({
        step: 'main_scraping',
        duration: mainResult.duration,
        status: 'success'
      });
      
      // 2. モバイルアプリのスクレイピング
      console.log('\n📱 ステップ2: モバイルアプリスクレイピング');
      console.log('-'.repeat(50));
      
      const mobileResult = await this.runCommand('node', ['batch-mobile-scraper.js'], this.pointincomeDir);
      results.steps.push({
        step: 'mobile_scraping',
        duration: mobileResult.duration,
        status: 'success'
      });
      
      // 3. データベース統合
      console.log('\n💾 ステップ3: データベース統合');
      console.log('-'.repeat(50));
      
      const integrationResult = await this.runCommand('node', ['integrate-to-database.js'], this.pointincomeDir);
      results.steps.push({
        step: 'database_integration',
        duration: integrationResult.duration,
        status: 'success'
      });
      
      // 4. 検索データ再生成
      console.log('\n🔍 ステップ4: 検索データ再生成');
      console.log('-'.repeat(50));
      
      const searchResult = await this.runCommand('node', ['scripts/generate-search-data.js'], this.projectRoot);
      results.steps.push({
        step: 'search_data_generation',
        duration: searchResult.duration,
        status: 'success'
      });
      
      // 5. 結果確認
      console.log('\n📊 ステップ5: 結果確認');
      console.log('-'.repeat(50));
      
      await this.verifyResults();
      
      results.endTime = new Date().toISOString();
      results.totalDuration = results.steps.reduce((sum, step) => sum + step.duration, 0);
      results.status = 'success';
      
      // レポート保存
      await fs.writeFile(
        path.join(this.projectRoot, 'production-scraping-report.json'),
        JSON.stringify(results, null, 2)
      );
      
      console.log('\n🎉 本番スクレイピング完了！');
      console.log(`⏱️ 総実行時間: ${Math.round(results.totalDuration / 60)}分`);
      console.log('📄 詳細レポート: production-scraping-report.json');
      
    } catch (error) {
      console.error('\n❌ 本番スクレイピング失敗:', error.message);
      
      results.endTime = new Date().toISOString();
      results.status = 'failed';
      results.error = error.message;
      
      await fs.writeFile(
        path.join(this.projectRoot, 'production-scraping-report.json'),
        JSON.stringify(results, null, 2)
      );
      
      throw error;
    }
  }

  async verifyResults() {
    console.log('🔍 結果検証中...');
    
    try {
      // 獅子の如くの確認
      const { stdout: shishiCheck } = await new Promise((resolve, reject) => {
        const child = spawn('grep', ['-c', '獅子の如く', 'public/search-data.json'], {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
        
        let stdout = '';
        child.stdout.on('data', (data) => stdout += data.toString());
        child.on('close', (code) => {
          resolve({ stdout: stdout.trim() });
        });
        child.on('error', reject);
      });
      
      console.log(`🎯 獅子の如く: ${shishiCheck}件発見`);
      
      // デバイス別統計
      const deviceStats = {};
      for (const device of ['iOS', 'Android', 'All']) {
        try {
          const { stdout } = await new Promise((resolve, reject) => {
            const child = spawn('grep', ['-c', `"device": "${device}"`, 'public/search-data.json'], {
              cwd: this.projectRoot,
              stdio: 'pipe'
            });
            
            let stdout = '';
            child.stdout.on('data', (data) => stdout += data.toString());
            child.on('close', (code) => {
              resolve({ stdout: stdout.trim() });
            });
            child.on('error', reject);
          });
          
          deviceStats[device] = parseInt(stdout) || 0;
        } catch (error) {
          deviceStats[device] = 0;
        }
      }
      
      console.log('📱 デバイス別統計:');
      Object.entries(deviceStats).forEach(([device, count]) => {
        console.log(`  ${device}: ${count}件`);
      });
      
      // ファイルサイズ確認
      const searchDataStats = await fs.stat(path.join(this.projectRoot, 'public/search-data.json'));
      console.log(`📏 search-data.json: ${Math.round(searchDataStats.size / 1024 / 1024 * 100) / 100}MB`);
      
    } catch (error) {
      console.error('結果検証エラー:', error.message);
    }
  }
}

// 実行
const runner = new ProductionScrapingRunner();
runner.runProductionScraping().catch(console.error);