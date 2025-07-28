const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ProductionPipelineExecutor {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.pointincomeDir = path.join(this.projectRoot, 'scripts', 'pointincome');
  }

  async executeCommand(command, workingDir = this.projectRoot) {
    return new Promise((resolve, reject) => {
      console.log(`\n🚀 実行中: ${command}`);
      console.log(`📁 ディレクトリ: ${workingDir}`);
      
      const startTime = Date.now();
      exec(command, { cwd: workingDir, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        if (error) {
          console.error(`❌ エラー (${duration}秒): ${error.message}`);
          reject(error);
        } else {
          console.log(`✅ 完了 (${duration}秒)`);
          if (stdout) console.log(stdout);
          if (stderr) console.warn('警告:', stderr);
          resolve({ stdout, stderr, duration });
        }
      });
    });
  }

  async runSystemDiagnosis() {
    console.log('🔍 システム診断実行');
    console.log('='.repeat(50));
    
    try {
      const result = await this.executeCommand('node system-diagnosis.js');
      console.log('✅ システム診断完了');
      return result;
    } catch (error) {
      console.error('❌ システム診断失敗:', error.message);
      return null;
    }
  }

  async runFullPipeline() {
    console.log('🎯 本番スクレイピングパイプライン実行');
    console.log('='.repeat(60));
    
    const results = {
      startTime: new Date().toISOString(),
      steps: []
    };

    try {
      // 1. システム診断
      console.log('\n📋 ステップ1: システム診断');
      const diagnosisResult = await this.runSystemDiagnosis();
      if (diagnosisResult) {
        results.steps.push({
          step: 'system_diagnosis',
          duration: diagnosisResult.duration,
          status: 'success'
        });
      }

      // 2. メインカテゴリスクレイピング
      console.log('\n🛍️ ステップ2: メインカテゴリスクレイピング');
      const mainResult = await this.executeCommand('node batch-scraper.js', this.pointincomeDir);
      results.steps.push({
        step: 'main_scraping',
        duration: mainResult.duration,
        status: 'success'
      });

      // 3. モバイルアプリスクレイピング
      console.log('\n📱 ステップ3: モバイルアプリスクレイピング');
      const mobileResult = await this.executeCommand('node batch-mobile-scraper.js', this.pointincomeDir);
      results.steps.push({
        step: 'mobile_scraping',
        duration: mobileResult.duration,
        status: 'success'
      });

      // 4. データベース統合
      console.log('\n💾 ステップ4: データベース統合');
      const integrationResult = await this.executeCommand('node integrate-to-database.js', this.pointincomeDir);
      results.steps.push({
        step: 'database_integration',
        duration: integrationResult.duration,
        status: 'success'
      });

      // 5. 検索データ生成
      console.log('\n🔍 ステップ5: 検索データ生成');
      const searchResult = await this.executeCommand('node scripts/generate-search-data.js');
      results.steps.push({
        step: 'search_data_generation',
        duration: searchResult.duration,
        status: 'success'
      });

      // 6. 結果検証
      console.log('\n📊 ステップ6: 結果検証');
      await this.verifyResults();

      results.endTime = new Date().toISOString();
      results.totalDuration = results.steps.reduce((sum, step) => sum + step.duration, 0);
      results.status = 'success';

      // レポート保存
      await fs.writeFile(
        path.join(this.projectRoot, 'pipeline-execution-report.json'),
        JSON.stringify(results, null, 2)
      );

      console.log('\n🎉 パイプライン実行完了！');
      console.log(`⏱️ 総実行時間: ${Math.round(results.totalDuration / 60)}分`);
      console.log('📄 詳細レポート: pipeline-execution-report.json');

      return results;

    } catch (error) {
      console.error('\n❌ パイプライン実行失敗:', error.message);
      
      results.endTime = new Date().toISOString();
      results.status = 'failed';
      results.error = error.message;

      await fs.writeFile(
        path.join(this.projectRoot, 'pipeline-execution-report.json'),
        JSON.stringify(results, null, 2)
      );

      throw error;
    }
  }

  async verifyResults() {
    try {
      // ファイル確認
      const files = [
        'scripts/pointincome/pointincome_batch_final.json',
        'scripts/pointincome/pointincome_mobile_batch_final.json',
        'public/search-data.json'
      ];

      for (const file of files) {
        const filePath = path.join(this.projectRoot, file);
        const stats = await fs.stat(filePath);
        console.log(`📄 ${file}: ${Math.round(stats.size / 1024)}KB (${stats.mtime.toLocaleString('ja-JP')})`);
        
        if (file.includes('search-data.json')) {
          const content = await fs.readFile(filePath, 'utf8');
          const hasShishi = content.includes('獅子の如く');
          console.log(`🎯 獅子の如く: ${hasShishi ? '✅ 確認済み' : '❌ 未確認'}`);
        }
      }

    } catch (error) {
      console.error('結果検証エラー:', error.message);
    }
  }
}

// 実行
const executor = new ProductionPipelineExecutor();
executor.runFullPipeline().catch(console.error);