const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class CompletePipelineRunner {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.pointincomeDir = path.join(this.projectRoot, 'scripts', 'pointincome');
    this.logFile = path.join(this.pointincomeDir, 'complete_pipeline_log.txt');
    this.startTime = Date.now();
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    
    try {
      await fs.appendFile(this.logFile, logMessage);
    } catch (error) {
      console.error('ログ書き込みエラー:', error.message);
    }
  }

  async executeCommand(command, workingDir = this.projectRoot, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 300000; // 5分デフォルト
      
      this.log(`🔄 実行: ${command} (${workingDir})`);
      
      const args = command.split(' ').slice(1);
      const child = spawn('node', args, {
        cwd: workingDir,
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      let timeoutHandle;
      
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`コマンドタイムアウト: ${command} (${timeout}ms)`));
        }, timeout);
      }
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // 重要な出力をリアルタイムで表示
        const lines = output.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && (
            trimmed.includes('✅') || 
            trimmed.includes('📊') || 
            trimmed.includes('🎉') || 
            trimmed.includes('❌') || 
            trimmed.includes('完了') ||
            trimmed.includes('エラー') ||
            trimmed.includes('進捗') ||
            trimmed.includes('総')
          );
        });
        
        lines.forEach(line => {
          if (line.trim()) {
            this.log(`  ${line.trim()}`);
          }
        });
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        
        this.log(`コマンド終了: ${command} (コード: ${code})`);
        
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`コマンド実行失敗: ${command} (終了コード: ${code})`));
        }
      });
      
      child.on('error', (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        reject(error);
      });
    });
  }

  async runCompletePipeline() {
    await this.log('🎯 ポイ速完全自動パイプライン開始');
    await this.log('=' .repeat(60));
    
    const results = {
      startTime: new Date().toISOString(),
      steps: []
    };
    
    try {
      // ステップ1: 自動継続スクレイピング
      await this.log('📍 ステップ1: 自動継続スクレイピング実行');
      const stepStartTime = Date.now();
      
      try {
        const scrapingResult = await this.executeCommand(
          'node auto-continuous-scraper.js', 
          this.pointincomeDir,
          { timeout: 0 } // タイムアウトなし
        );
        
        results.steps.push({
          step: 'auto_continuous_scraping',
          duration: Math.round((Date.now() - stepStartTime) / 1000),
          status: 'success'
        });
        
        await this.log('✅ ステップ1完了: 自動継続スクレイピング');
        
      } catch (error) {
        await this.log(`❌ ステップ1失敗: ${error.message}`);
        
        // 失敗時はマニュアルスクレイピングで続行
        await this.log('🔄 マニュアルスクレイピングで続行');
        
        results.steps.push({
          step: 'auto_continuous_scraping',
          duration: Math.round((Date.now() - stepStartTime) / 1000),
          status: 'failed',
          error: error.message
        });
      }
      
      // ステップ2: データ統合
      await this.log('📍 ステップ2: データベース統合実行');
      const integrationStartTime = Date.now();
      
      try {
        const integrationResult = await this.executeCommand(
          'node integrate-to-database.js',
          this.pointincomeDir,
          { timeout: 180000 } // 3分タイムアウト
        );
        
        results.steps.push({
          step: 'database_integration',
          duration: Math.round((Date.now() - integrationStartTime) / 1000),
          status: 'success'
        });
        
        await this.log('✅ ステップ2完了: データベース統合');
        
      } catch (error) {
        await this.log(`❌ ステップ2失敗: ${error.message}`);
        
        results.steps.push({
          step: 'database_integration',
          duration: Math.round((Date.now() - integrationStartTime) / 1000),
          status: 'failed',
          error: error.message
        });
      }
      
      // ステップ3: 検索データ生成
      await this.log('📍 ステップ3: 検索データ生成実行');
      const searchStartTime = Date.now();
      
      try {
        const searchResult = await this.executeCommand(
          'node scripts/generate-search-data.js',
          this.projectRoot,
          { timeout: 180000 } // 3分タイムアウト
        );
        
        results.steps.push({
          step: 'search_data_generation',
          duration: Math.round((Date.now() - searchStartTime) / 1000),
          status: 'success'
        });
        
        await this.log('✅ ステップ3完了: 検索データ生成');
        
      } catch (error) {
        await this.log(`❌ ステップ3失敗: ${error.message}`);
        
        results.steps.push({
          step: 'search_data_generation',
          duration: Math.round((Date.now() - searchStartTime) / 1000),
          status: 'failed',
          error: error.message
        });
      }
      
      // ステップ4: 結果検証
      await this.log('📍 ステップ4: 結果検証');
      await this.verifyResults();
      
      // 結果サマリー
      results.endTime = new Date().toISOString();
      results.totalDuration = Math.round((Date.now() - this.startTime) / 1000);
      results.status = 'completed';
      
      const successSteps = results.steps.filter(step => step.status === 'success').length;
      const failedSteps = results.steps.filter(step => step.status === 'failed').length;
      
      await this.log('🎉 完全自動パイプライン実行完了！');
      await this.log(`📊 成功ステップ: ${successSteps}/${results.steps.length}`);
      await this.log(`❌ 失敗ステップ: ${failedSteps}/${results.steps.length}`);
      await this.log(`⏱️ 総実行時間: ${Math.round(results.totalDuration / 60)}分`);
      
      // 結果レポート保存
      await fs.writeFile(
        path.join(this.pointincomeDir, 'complete_pipeline_report.json'),
        JSON.stringify(results, null, 2)
      );
      
      return results;
      
    } catch (error) {
      await this.log(`❌ パイプライン致命的エラー: ${error.message}`);
      
      results.endTime = new Date().toISOString();
      results.totalDuration = Math.round((Date.now() - this.startTime) / 1000);
      results.status = 'failed';
      results.error = error.message;
      
      throw error;
    }
  }

  async verifyResults() {
    try {
      // データファイルの確認
      const files = [
        'pointincome_complete_all_campaigns.json',
        'pointincome_mobile_batch_final.json',
        path.join('..', '..', 'public', 'search-data.json')
      ];
      
      for (const file of files) {
        const filePath = path.join(this.pointincomeDir, file);
        
        try {
          const stats = await fs.stat(filePath);
          const sizeKB = Math.round(stats.size / 1024);
          await this.log(`📄 ${file}: ${sizeKB}KB (${stats.mtime.toLocaleString('ja-JP')})`);
          
          // 検索データの獅子の如くチェック
          if (file.includes('search-data.json')) {
            const content = await fs.readFile(filePath, 'utf8');
            const hasShishi = content.includes('獅子の如く');
            await this.log(`🎯 獅子の如く: ${hasShishi ? '✅ 確認済み' : '❌ 未確認'}`);
          }
          
        } catch (error) {
          await this.log(`⚠️ ${file}: ファイルが見つかりません`);
        }
      }
      
      // ポイントインカム完全データの詳細チェック
      try {
        const completeDataPath = path.join(this.pointincomeDir, 'pointincome_complete_all_campaigns.json');
        const completeData = JSON.parse(await fs.readFile(completeDataPath, 'utf8'));
        
        if (completeData.campaigns) {
          await this.log(`📊 ポイントインカム案件数: ${completeData.campaigns.length}件`);
          
          if (completeData.summary) {
            await this.log(`📊 完了率: ${completeData.summary.completion_rate}%`);
            await this.log(`📊 完了カテゴリ: ${completeData.summary.completed_categories}/${completeData.summary.total_categories}`);
            await this.log(`❌ エラー数: ${completeData.summary.errors}件`);
          }
        }
        
      } catch (error) {
        await this.log(`⚠️ 完全データファイルの読み込みエラー: ${error.message}`);
      }
      
    } catch (error) {
      await this.log(`❌ 結果検証エラー: ${error.message}`);
    }
  }
}

// 実行
(async () => {
  const runner = new CompletePipelineRunner();
  
  try {
    const results = await runner.runCompletePipeline();
    
    console.log('\n🎉 ポイ速完全自動パイプライン完了！');
    console.log(`📊 総実行時間: ${Math.round(results.totalDuration / 60)}分`);
    console.log('📄 詳細レポート: complete_pipeline_report.json');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ パイプライン実行失敗:', error.message);
    process.exit(1);
  }
})();