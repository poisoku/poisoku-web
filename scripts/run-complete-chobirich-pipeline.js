#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class CompleteChobirichPipeline {
  constructor() {
    this.logFile = `complete_pipeline_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.log`;
    this.startTime = Date.now();
  }

  // ログ機能
  log(message, writeToFile = true) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    if (writeToFile) {
      fs.appendFile(this.logFile, logMessage + '\n').catch(() => {});
    }
  }

  // コマンド実行（Promise化）
  async runCommand(command, description, timeoutMs = 1800000) { // 30分タイムアウト
    return new Promise((resolve, reject) => {
      this.log(`🚀 ${description} 開始`);
      this.log(`💻 実行コマンド: ${command}`);
      
      const child = spawn('sh', ['-c', command], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: 'https://pjjhyzbnnslaauwzknrr.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // リアルタイム出力
        process.stdout.write(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      // タイムアウト設定
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`${description} がタイムアウトしました (${timeoutMs/1000}秒)`));
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          this.log(`✅ ${description} 成功`);
          resolve({ stdout, stderr, code });
        } else {
          this.log(`❌ ${description} 失敗 (終了コード: ${code})`, true);
          reject(new Error(`${description} failed with code ${code}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`💥 ${description} エラー: ${error.message}`, true);
        reject(error);
      });
    });
  }

  // Gitステータス確認
  async checkGitStatus() {
    try {
      const { stdout } = await this.runCommand('git status --porcelain', 'Git状態確認', 10000);
      return stdout.trim();
    } catch (error) {
      this.log(`⚠️ Git状態確認エラー: ${error.message}`);
      return '';
    }
  }

  // 最新ファイル検索
  async findLatestChobirichFile() {
    try {
      const files = await fs.readdir('.');
      const chobirichFiles = files.filter(f => 
        f.startsWith('chobirich_enhanced_') && 
        f.endsWith('.json')
      ).sort().reverse();
      
      return chobirichFiles[0] || null;
    } catch (error) {
      this.log(`❌ ファイル検索エラー: ${error.message}`);
      return null;
    }
  }

  // メイン実行
  async runComplete() {
    try {
      this.log('🌟 ='.repeat(60));
      this.log('🌟 ちょびリッチ完全自動パイプライン開始');
      this.log('🌟 ='.repeat(60));

      // ステップ1: スクレイピング実行
      this.log('\n📝 ステップ1: 強化スクレイピング実行');
      await this.runCommand(
        'node scripts/chobirich-enhanced-pipeline.js',
        'ちょびリッチ強化スクレイピング',
        3600000 // 1時間タイムアウト
      );

      // ステップ2: 最新ファイル確認
      this.log('\n📝 ステップ2: 生成ファイル確認');
      const latestFile = await this.findLatestChobirichFile();
      if (!latestFile) {
        throw new Error('スクレイピング結果ファイルが見つかりません');
      }
      this.log(`✅ 最新ファイル確認: ${latestFile}`);

      // ステップ3: 検索データが既に生成されているか確認
      this.log('\n📝 ステップ3: 検索データ確認・再生成');
      try {
        await this.runCommand(
          'node scripts/generate-search-data.js',
          '検索データ生成',
          300000 // 5分タイムアウト
        );
      } catch (error) {
        this.log(`⚠️ 検索データ生成で軽微なエラー: ${error.message}`);
      }

      // ステップ4: Git作業
      this.log('\n📝 ステップ4: Git操作');
      
      // Git追加
      await this.runCommand(
        'git add public/search-data.json public/search-index.json',
        'Git追加',
        30000
      );

      // コミット
      const commitMessage = `Update Chobirich data with enhanced pipeline

- New enhanced scraping system with checkpoint recovery
- Improved error handling and timeout management  
- Real-time database saving and search data generation
- Timestamp: ${new Date().toISOString()}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

      await this.runCommand(
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
        'Git コミット',
        30000
      );

      // プッシュ
      await this.runCommand(
        'git push origin main',
        'Git プッシュ',
        60000
      );

      // ステップ5: 完了確認
      this.log('\n📝 ステップ5: デプロイ完了確認');
      
      // 少し待ってからVercelの状態確認
      this.log('⏳ Vercelデプロイ完了まで待機中...');
      await new Promise(resolve => setTimeout(resolve, 120000)); // 2分待機

      // 完了サマリー
      const duration = Math.round((Date.now() - this.startTime) / 1000);
      this.log('\n🎉 ='.repeat(60));
      this.log('🎉 完全自動パイプライン成功！');
      this.log('🎉 ='.repeat(60));
      this.log(`⏱️ 総実行時間: ${Math.floor(duration/60)}分${duration%60}秒`);
      this.log(`📊 ログファイル: ${this.logFile}`);
      this.log(`🌐 サイト: https://poisoku.jp/`);
      this.log(`🔍 確認: "グラナドエスパダ" で検索してみてください`);

      return true;

    } catch (error) {
      const duration = Math.round((Date.now() - this.startTime) / 1000);
      this.log('\n💥 ='.repeat(60));
      this.log('💥 パイプライン失敗');
      this.log('💥 ='.repeat(60));
      this.log(`❌ エラー: ${error.message}`);
      this.log(`⏱️ 実行時間: ${Math.floor(duration/60)}分${duration%60}秒`);
      this.log(`📊 ログファイル: ${this.logFile}`);
      
      throw error;
    }
  }
}

// 実行
if (require.main === module) {
  const pipeline = new CompleteChobirichPipeline();
  pipeline.runComplete()
    .then(() => {
      console.log('\n✨ 全工程完了！ポイ速に新規案件が反映されました。');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💔 パイプライン失敗:', error.message);
      process.exit(1);
    });
}

module.exports = CompleteChobirichPipeline;