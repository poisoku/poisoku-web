const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AutoContinuousScraper {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.scriptPath = path.join(this.projectRoot, 'scripts', 'pointincome', 'long-running-complete-scraper.js');
    this.progressFile = path.join(this.projectRoot, 'scripts', 'pointincome', 'complete_scraping_progress.json');
    this.finalDataFile = path.join(this.projectRoot, 'scripts', 'pointincome', 'pointincome_complete_all_campaigns.json');
    
    this.maxExecutions = 100; // 最大実行回数（安全装置）
    this.executionCount = 0;
    this.startTime = Date.now();
    this.totalCategories = 39;
    
    this.logFile = path.join(this.projectRoot, 'scripts', 'pointincome', 'auto_scraping_log.txt');
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

  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async getProgress() {
    try {
      if (await this.fileExists(this.progressFile)) {
        const data = await fs.readFile(this.progressFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      await this.log(`進捗読み込みエラー: ${error.message}`);
    }
    return null;
  }

  async getFinalData() {
    try {
      if (await this.fileExists(this.finalDataFile)) {
        const data = await fs.readFile(this.finalDataFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      await this.log(`最終データ読み込みエラー: ${error.message}`);
    }
    return null;
  }

  async isComplete() {
    const progress = await this.getProgress();
    if (!progress) return false;
    
    const completedCategories = progress.completedCategories ? progress.completedCategories.length : 0;
    const isComplete = completedCategories >= this.totalCategories;
    
    await this.log(`進捗確認: ${completedCategories}/${this.totalCategories}カテゴリ完了 (${Math.round(completedCategories/this.totalCategories*100)}%)`);
    
    return isComplete;
  }

  async executeScrapingRound() {
    return new Promise((resolve, reject) => {
      this.executionCount++;
      
      this.log(`🚀 実行ラウンド ${this.executionCount} 開始`);
      
      const child = spawn('node', [this.scriptPath], {
        cwd: path.dirname(this.scriptPath),
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // リアルタイムでログ出力
        const lines = output.split('\n').filter(line => line.trim());
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
        this.log(`実行ラウンド ${this.executionCount} 終了 (コード: ${code})`);
        
        if (stderr && stderr.trim()) {
          this.log(`エラー出力: ${stderr.trim()}`);
        }
        
        resolve({
          code,
          stdout,
          stderr,
          executionCount: this.executionCount
        });
      });
      
      child.on('error', (error) => {
        this.log(`実行エラー: ${error.message}`);
        reject(error);
      });
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runContinuousScaping() {
    await this.log('🎯 自動継続スクレイピングシステム開始');
    await this.log(`📊 対象: ${this.totalCategories}カテゴリ`);
    await this.log(`🔄 最大実行回数: ${this.maxExecutions}回`);
    
    try {
      while (this.executionCount < this.maxExecutions) {
        // 完了チェック
        if (await this.isComplete()) {
          await this.log('🎉 全カテゴリ完了！');
          break;
        }
        
        // スクレイピング実行
        const result = await this.executeScrapingRound();
        
        // 進捗確認
        const progress = await this.getProgress();
        if (progress) {
          const completedCategories = progress.completedCategories ? progress.completedCategories.length : 0;
          const totalResults = progress.totalResults || 0;
          const elapsedMinutes = Math.round((Date.now() - this.startTime) / 60000);
          
          await this.log(`📊 現在の進捗: ${completedCategories}/${this.totalCategories}カテゴリ`);
          await this.log(`📊 取得済み案件: ${totalResults}件`);
          await this.log(`⏱️ 経過時間: ${elapsedMinutes}分`);
        }
        
        // 次回実行までの待機（2秒）
        await this.sleep(2000);
      }
      
      // 最終結果の確認
      const finalData = await this.getFinalData();
      if (finalData) {
        await this.log('📊 最終結果:');
        await this.log(`  総案件数: ${finalData.campaigns ? finalData.campaigns.length : 0}件`);
        await this.log(`  完了率: ${finalData.summary ? finalData.summary.completion_rate : 0}%`);
        await this.log(`  エラー数: ${finalData.summary ? finalData.summary.errors : 0}件`);
      }
      
      const totalElapsed = Math.round((Date.now() - this.startTime) / 60000);
      await this.log(`🎯 自動継続スクレイピング完了`);
      await this.log(`⏱️ 総実行時間: ${totalElapsed}分`);
      await this.log(`🔄 実行ラウンド数: ${this.executionCount}回`);
      
      return finalData;
      
    } catch (error) {
      await this.log(`❌ 致命的エラー: ${error.message}`);
      throw error;
    }
  }

  async runFullPipeline() {
    await this.log('🎯 完全自動パイプライン開始');
    
    try {
      // 1. 継続スクレイピング実行
      await this.log('📍 ステップ1: 継続スクレイピング実行');
      const scrapingResult = await this.runContinuousScaping();
      
      if (!scrapingResult || !scrapingResult.campaigns || scrapingResult.campaigns.length === 0) {
        throw new Error('スクレイピングデータが取得できませんでした');
      }
      
      await this.log(`✅ スクレイピング完了: ${scrapingResult.campaigns.length}件`);
      
      // 2. データ統合実行
      await this.log('📍 ステップ2: データベース統合実行');
      const integrationResult = await this.executeCommand('node integrate-to-database.js');
      await this.log('✅ データベース統合完了');
      
      // 3. 検索データ生成
      await this.log('📍 ステップ3: 検索データ生成実行');
      const searchResult = await this.executeCommand('node scripts/generate-search-data.js');
      await this.log('✅ 検索データ生成完了');
      
      await this.log('🎉 完全自動パイプライン完了！');
      
      return {
        scrapingResult,
        integrationResult,
        searchResult,
        totalCampaigns: scrapingResult.campaigns.length,
        executionRounds: this.executionCount
      };
      
    } catch (error) {
      await this.log(`❌ パイプラインエラー: ${error.message}`);
      throw error;
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const workingDir = command.startsWith('node scripts/') ? this.projectRoot : path.dirname(this.scriptPath);
      
      this.log(`🔄 実行: ${command}`);
      
      const child = spawn('node', command.split(' ').slice(1), {
        cwd: workingDir,
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // 重要な出力のみログ
        const lines = output.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && (
            trimmed.includes('✅') || 
            trimmed.includes('📊') || 
            trimmed.includes('🎉') || 
            trimmed.includes('❌') || 
            trimmed.includes('完了') ||
            trimmed.includes('エラー')
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
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`コマンド実行失敗: ${command} (終了コード: ${code})`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

// 実行
(async () => {
  const scraper = new AutoContinuousScraper();
  
  try {
    const result = await scraper.runFullPipeline();
    console.log('\n🎉 完全自動パイプライン実行完了！');
    console.log(`📊 取得案件数: ${result.totalCampaigns}件`);
    console.log(`🔄 実行ラウンド数: ${result.executionRounds}回`);
    
  } catch (error) {
    console.error('❌ パイプライン実行失敗:', error.message);
    process.exit(1);
  }
})();