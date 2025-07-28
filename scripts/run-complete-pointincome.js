const { spawn } = require('child_process');
const fs = require('fs').promises;

class CompletePointIncomeRunner {
  constructor() {
    this.maxRunTime = 110000; // 1分50秒（2分タイムアウト前に終了）
    this.progressFile = 'timeout_free_progress.json';
    this.maxIterations = 100; // 最大100回実行（安全装置）
    this.currentIteration = 0;
  }

  async checkProgress() {
    try {
      if (await this.fileExists(this.progressFile)) {
        const progressData = JSON.parse(await fs.readFile(this.progressFile, 'utf8'));
        return {
          completedCategories: progressData.completedCategories ? progressData.completedCategories.length : 0,
          totalCategories: progressData.totalCategories || 39,
          isComplete: progressData.completedCategories ? progressData.completedCategories.length >= 39 : false,
          currentCategory: progressData.currentCategoryProgress || null
        };
      }
    } catch (error) {
      console.log('⚠️ 進捗ファイル読み込みエラー、初回実行として開始');
    }
    return {
      completedCategories: 0,
      totalCategories: 39,
      isComplete: false,
      currentCategory: null
    };
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async runScrapingSession() {
    return new Promise((resolve, reject) => {
      console.log(`\n🔄 スクレイピングセッション開始 [${this.currentIteration + 1}回目]`);
      
      const scraperProcess = spawn('node', ['scripts/pointincome/timeout-free-scraper.js'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      scraperProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text); // リアルタイム出力
      });

      scraperProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      // 時間制限付きで実行
      const timeout = setTimeout(() => {
        console.log('\n⏰ セッション時間制限に達しました。安全に終了します...');
        scraperProcess.kill('SIGTERM');
      }, this.maxRunTime);

      scraperProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`\n✅ セッション終了 (コード: ${code})`);
        resolve({ code, output, errorOutput });
      });

      scraperProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`\n❌ プロセスエラー: ${error.message}`);
        reject(error);
      });
    });
  }

  async run() {
    console.log('🚀 ポイントインカム完全自動スクレイピングシステム開始');
    console.log('⏰ セッション制御: 1分50秒ごとに自動再開');
    console.log('💾 進捗保存: 自動継続可能\n');

    try {
      while (this.currentIteration < this.maxIterations) {
        // 進捗チェック
        const progress = await this.checkProgress();
        console.log(`📊 現在の進捗: ${progress.completedCategories}/${progress.totalCategories}カテゴリ完了`);
        
        if (progress.isComplete) {
          console.log('\n🎉 全カテゴリのスクレイピングが完了しました！');
          break;
        }

        // スクレイピング実行
        const result = await this.runScrapingSession();
        this.currentIteration++;

        // エラーチェック
        if (result.errorOutput && result.errorOutput.includes('Error')) {
          console.log('\n⚠️ エラーが検出されました。5秒待機後に再試行します...');
          await this.sleep(5000);
        } else {
          console.log('\n✅ セッション正常終了。2秒待機後に次のセッションを開始...');
          await this.sleep(2000);
        }
      }

      if (this.currentIteration >= this.maxIterations) {
        console.log('\n⚠️ 最大実行回数に達しました。手動で進捗を確認してください。');
      }

      // 最終進捗確認
      const finalProgress = await this.checkProgress();
      console.log(`\n📋 最終結果: ${finalProgress.completedCategories}/${finalProgress.totalCategories}カテゴリ完了`);
      console.log(`🔄 実行回数: ${this.currentIteration}回`);

    } catch (error) {
      console.error('❌ システムエラー:', error);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 実行
(async () => {
  const runner = new CompletePointIncomeRunner();
  await runner.run();
})();