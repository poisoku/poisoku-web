const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ImprovedAutoPipeline {
  constructor() {
    this.projectRoot = '/Users/kn/poisoku-web';
    this.pointincomeDir = path.join(this.projectRoot, 'scripts', 'pointincome');
    this.progressFile = path.join(this.pointincomeDir, 'complete_scraping_progress.json');
    this.logFile = path.join(this.pointincomeDir, 'full_auto_pipeline_log.txt');
    
    this.maxExecutions = 50;
    this.executionCount = 0;
    this.startTime = Date.now();
    this.totalCategories = 39;
    this.waitBetweenExecutions = 3000; // 3秒待機
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

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    return { completedCategories: [], totalResults: 0 };
  }

  async isComplete() {
    const progress = await this.getProgress();
    const completedCategories = progress.completedCategories ? progress.completedCategories.length : 0;
    const isComplete = completedCategories >= this.totalCategories;
    
    const completionRate = Math.round((completedCategories / this.totalCategories) * 100);
    await this.log(`📊 進捗: ${completedCategories}/${this.totalCategories}カテゴリ完了 (${completionRate}%)`);
    
    return { isComplete, completedCategories, totalResults: progress.totalResults || 0 };
  }

  async executePipelineRound() {
    return new Promise((resolve) => {
      this.executionCount++;
      
      const child = spawn('node', ['run-complete-pipeline.js'], {
        cwd: this.pointincomeDir,
        stdio: 'pipe',
        timeout: 400000 // 6分40秒タイムアウト
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // 重要な進捗のみ表示
        const lines = output.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed && (
            trimmed.includes('📊 進捗:') || 
            trimmed.includes('✅') || 
            trimmed.includes('📊 完了カテゴリ:') || 
            trimmed.includes('🎉') || 
            trimmed.includes('❌') || 
            trimmed.includes('総案件数') ||
            trimmed.includes('完了率')
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
        resolve({
          code,
          stdout,
          stderr,
          executionCount: this.executionCount
        });
      });
      
      child.on('error', (error) => {
        this.log(`実行エラー: ${error.message}`);
        resolve({
          code: -1,
          stdout,
          stderr: error.message,
          executionCount: this.executionCount
        });
      });
    });
  }

  async runFullAutoPipeline() {
    await this.log('🚀 ポイ速完全自動パイプライン開始');
    await this.log('📊 タイムアウト制限を克服した完全自動実行');
    await this.log(`⏱️ 推定実行時間: 60-120分`);
    await this.log(`🔄 最大実行回数: ${this.maxExecutions}回`);
    await this.log('=' .repeat(60));
    
    try {
      while (this.executionCount < this.maxExecutions) {
        const elapsedMinutes = Math.round((Date.now() - this.startTime) / 60000);
        
        await this.log(`📍 実行ラウンド ${this.executionCount + 1}/${this.maxExecutions}`);
        await this.log(`⏱️ 経過時間: ${elapsedMinutes}分`);
        
        // 完了チェック
        const { isComplete, completedCategories, totalResults } = await this.isComplete();
        
        if (isComplete) {
          await this.log('🎉 全カテゴリ完了！');
          break;
        }
        
        // パイプライン実行
        const result = await this.executePipelineRound();
        
        // 実行後の完了チェック
        const { isComplete: isCompleteAfter, completedCategories: completedAfter, totalResults: totalAfter } = await this.isComplete();
        
        if (isCompleteAfter) {
          await this.log('🎉 全カテゴリ完了！');
          break;
        }
        
        // 進捗情報の表示
        const progress = completedAfter - completedCategories;
        if (progress > 0) {
          await this.log(`📈 このラウンドで${progress}カテゴリ完了`);
        }
        
        const newResults = totalAfter - totalResults;
        if (newResults > 0) {
          await this.log(`📊 新規取得案件: ${newResults}件`);
        }
        
        // 次回実行までの待機
        if (this.executionCount < this.maxExecutions) {
          await this.log(`⏸️ ${this.waitBetweenExecutions/1000}秒待機後に自動再実行...`);
          await this.sleep(this.waitBetweenExecutions);
        }
      }
      
      // 最終結果
      const finalElapsed = Math.round((Date.now() - this.startTime) / 60000);
      const { isComplete: finalComplete, completedCategories: finalCompleted, totalResults: finalTotal } = await this.isComplete();
      
      await this.log('=' .repeat(60));
      await this.log('🎯 完全自動パイプライン実行完了');
      await this.log(`⏱️ 総実行時間: ${finalElapsed}分`);
      await this.log(`🔄 実行ラウンド数: ${this.executionCount}回`);
      await this.log(`📊 完了カテゴリ: ${finalCompleted}/${this.totalCategories}`);
      await this.log(`📊 総取得案件数: ${finalTotal}件`);
      
      if (finalComplete) {
        await this.log('✅ 全カテゴリ処理完了！');
        await this.log('🎉 ポイ速サイトに全データが反映されました！');
      } else {
        await this.log('⚠️ 最大実行回数に達しました');
        await this.log('📊 現在の進捗を確認してください');
      }
      
      return {
        isComplete: finalComplete,
        completedCategories: finalCompleted,
        totalResults: finalTotal,
        executionCount: this.executionCount,
        totalTimeMinutes: finalElapsed
      };
      
    } catch (error) {
      await this.log(`❌ 致命的エラー: ${error.message}`);
      throw error;
    }
  }
}

// 実行
(async () => {
  const pipeline = new ImprovedAutoPipeline();
  
  try {
    const result = await pipeline.runFullAutoPipeline();
    
    console.log('\n🎉 完全自動パイプライン実行完了！');
    console.log(`📊 完了カテゴリ: ${result.completedCategories}/${39}`);
    console.log(`📊 総取得案件数: ${result.totalResults}件`);
    console.log(`⏱️ 総実行時間: ${result.totalTimeMinutes}分`);
    console.log(`🔄 実行ラウンド数: ${result.executionCount}回`);
    
    if (result.isComplete) {
      console.log('✅ 全カテゴリ処理完了！');
      process.exit(0);
    } else {
      console.log('⚠️ 部分完了 - 手動で再実行してください');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ パイプライン実行失敗:', error.message);
    process.exit(1);
  }
})();