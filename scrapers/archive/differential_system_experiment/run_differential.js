#!/usr/bin/env node

/**
 * ちょびリッチ差分取得システム統合実行スクリプト
 * 1日4回の定期実行用
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class DifferentialRunner {
  constructor() {
    this.scriptsDir = __dirname;
    this.logDir = path.join(__dirname, 'logs', 'differential');
    this.scheduleConfig = {
      // 1日4回の実行スケジュール
      times: ['06:00', '12:00', '18:00', '02:00'],
      timezone: 'Asia/Tokyo'
    };
  }

  async execute() {
    console.log('🔄 ちょびリッチ差分取得システム統合実行');
    console.log('='.repeat(60));
    console.log(`⏰ 実行時刻: ${new Date().toLocaleString('ja-JP')}`);
    console.log(`📁 ログ出力: ${this.logDir}`);
    console.log('');

    // ログディレクトリ作成
    await fs.mkdir(this.logDir, { recursive: true });

    try {
      // Step 1: ベースライン存在確認
      await this.checkBaseline();
      
      // Step 2: 差分取得実行
      const diffResults = await this.runDifferentialScan();
      
      // Step 3: 差分が存在する場合の後続処理
      if (diffResults.hasDifferences) {
        await this.processDifferences(diffResults);
      }
      
      // Step 4: 完了報告
      await this.generateSummaryReport(diffResults);
      
    } catch (error) {
      console.error('💥 統合実行エラー:', error);
      await this.logError(error);
      throw error;
    }
  }

  /**
   * ベースライン存在確認
   */
  async checkBaseline() {
    console.log('🔍 Step 1: ベースライン確認');
    console.log('-'.repeat(40));

    const baselineFile = path.join(this.scriptsDir, 'data', 'chobirich_baseline.json');
    
    try {
      await fs.access(baselineFile);
      const stats = await fs.stat(baselineFile);
      const ageHours = (Date.now() - stats.mtime.getTime()) / 1000 / 60 / 60;
      
      console.log(`✅ ベースライン存在確認済み`);
      console.log(`   最終更新: ${stats.mtime.toLocaleString('ja-JP')}`);
      console.log(`   経過時間: ${ageHours.toFixed(1)}時間前`);
      
      // 24時間以上古い場合は警告
      if (ageHours > 24) {
        console.log('⚠️ ベースラインが24時間以上古いです');
        console.log('💡 推奨: 完全取得でベースライン更新を検討');
      }
      
    } catch (error) {
      console.log('❌ ベースラインが存在しません');
      console.log('🔧 自動ベースライン作成を実行...');
      
      await this.runScript('create_baseline.js');
      console.log('✅ ベースライン作成完了');
    }
  }

  /**
   * 差分スキャン実行
   */
  async runDifferentialScan() {
    console.log('\\n⚡ Step 2: 差分スキャン実行');
    console.log('-'.repeat(40));

    const startTime = Date.now();
    
    try {
      await this.runScript('chobirich_differential_system.js');
      
      // 結果ファイル読み込み
      const deltaFile = path.join(this.scriptsDir, 'data', 'chobirich_delta.json');
      const deltaData = JSON.parse(await fs.readFile(deltaFile, 'utf8'));
      
      const processingTime = Date.now() - startTime;
      const hasDifferences = deltaData.summary.differenceCount > 0;
      
      console.log(`✅ 差分スキャン完了 (${(processingTime/1000/60).toFixed(1)}分)`);
      console.log(`   差分検出: ${deltaData.summary.differenceCount}件`);
      
      return {
        hasDifferences,
        deltaData,
        processingTime
      };
      
    } catch (error) {
      console.error('❌ 差分スキャン失敗:', error.message);
      throw error;
    }
  }

  /**
   * 差分処理
   */
  async processDifferences(diffResults) {
    console.log('\\n📊 Step 3: 差分処理');
    console.log('-'.repeat(40));

    const { deltaData } = diffResults;
    
    console.log('🔄 検索データ更新中...');
    
    try {
      // まず、ベースライン更新（現在のデータを新しいベースラインとして設定）
      await this.updateBaseline();
      
      // 検索データ変換・更新
      await this.runScript('../convert_v3_to_search_data.js');
      
      // データ検証・修正
      await this.runScript('../validate_and_fix_point_data.js');
      
      console.log('✅ 差分処理完了');
      console.log('💡 検索データが最新状態に更新されました');
      
    } catch (error) {
      console.error('❌ 差分処理エラー:', error.message);
      throw error;
    }
  }

  /**
   * ベースライン更新
   */
  async updateBaseline() {
    console.log('🔄 ベースライン更新中...');
    
    // 現在のv3データからベースライン再生成
    await this.runScript('create_baseline.js');
    
    console.log('✅ ベースライン更新完了');
  }

  /**
   * 完了レポート生成
   */
  async generateSummaryReport(diffResults) {
    console.log('\\n📋 実行完了サマリー');
    console.log('='.repeat(60));

    const currentTime = new Date();
    const nextRun = this.calculateNextRun(currentTime);
    
    console.log(`⏰ 実行完了: ${currentTime.toLocaleString('ja-JP')}`);
    console.log(`⌛ 処理時間: ${(diffResults.processingTime/1000/60).toFixed(1)}分`);
    
    if (diffResults.hasDifferences) {
      const { summary } = diffResults.deltaData;
      console.log(`🔄 差分処理: ${summary.differenceCount}件の変更を検出・反映`);
      console.log(`   🆕 新規: ${summary.newCampaigns}件`);
      console.log(`   🔄 更新: ${summary.updatedCampaigns}件`);
      console.log(`   🗑️ 削除: ${summary.deletedCampaigns}件`);
    } else {
      console.log('✨ 変更なし: データは最新状態を維持');
    }
    
    console.log(`\\n⏰ 次回実行予定: ${nextRun.toLocaleString('ja-JP')}`);
    
    // 効率レポート
    if (diffResults.processingTime < 15 * 60 * 1000) { // 15分未満
      console.log('🏆 目標達成: 15分以内での差分処理完了');
    }
  }

  /**
   * 次回実行時刻計算
   */
  calculateNextRun(currentTime) {
    const now = new Date(currentTime);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const timeStr of this.scheduleConfig.times) {
      const [hour, minute] = timeStr.split(':').map(Number);
      const scheduleTime = new Date(today.getTime());
      scheduleTime.setHours(hour, minute, 0, 0);
      
      if (scheduleTime > now) {
        return scheduleTime;
      }
    }
    
    // 今日のスケジュールがすべて過ぎている場合は翌日の最初
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const [firstHour, firstMinute] = this.scheduleConfig.times[0].split(':').map(Number);
    tomorrow.setHours(firstHour, firstMinute, 0, 0);
    
    return tomorrow;
  }

  /**
   * スクリプト実行
   */
  async runScript(scriptPath) {
    const fullPath = scriptPath.startsWith('/') ? scriptPath : path.join(this.scriptsDir, scriptPath);
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [fullPath], {
        stdio: 'inherit',
        cwd: this.scriptsDir
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script ${scriptPath} failed with code ${code}`));
        }
      });
      
      child.on('error', reject);
    });
  }

  /**
   * エラーログ記録
   */
  async logError(error) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(this.logDir, `error_${timestamp.split('T')[0]}.log`);
    
    const errorLog = {
      timestamp,
      error: error.message,
      stack: error.stack
    };
    
    await fs.appendFile(logFile, JSON.stringify(errorLog, null, 2) + '\\n');
  }
}

// 実行
async function main() {
  const runner = new DifferentialRunner();
  
  try {
    await runner.execute();
    console.log('\\n🎉 差分取得システム実行完了');
    process.exit(0);
  } catch (error) {
    console.error('💥 実行失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DifferentialRunner;