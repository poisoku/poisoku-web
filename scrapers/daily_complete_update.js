#!/usr/bin/env node

/**
 * ちょびリッチ日次完全更新システム
 * シンプル・確実・メンテナンス性重視
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DailyCompleteUpdate {
  constructor() {
    this.logFile = path.join(__dirname, 'logs', `daily_update_${new Date().toISOString().split('T')[0]}.log`);
    this.stats = {
      startTime: null,
      endTime: null,
      totalTime: 0,
      steps: []
    };
  }

  async execute() {
    console.log('🔄 ちょびリッチ日次完全更新システム');
    console.log('='.repeat(60));
    console.log('🎯 シンプル・確実・100%取得保証');
    console.log('');

    this.stats.startTime = new Date();
    await this.ensureLogDirectory();

    try {
      // Step 1: 完全取得
      await this.executeStep('complete_chobirich_system_v3.js', '完全案件取得', 45);
      
      // Step 2: 検索データ変換
      await this.executeStep('convert_v3_to_search_data.js', '検索データ変換', 1);
      
      // Step 3: データ検証・修正
      await this.executeStep('validate_and_fix_point_data.js', 'データ検証・修正', 1);
      
      // Step 4: 完了報告
      await this.generateFinalReport();
      
    } catch (error) {
      await this.logError(error);
      throw error;
    }
  }

  async executeStep(scriptName, description, expectedMinutes) {
    console.log(`\n⚡ ${description}中...`);
    console.log(`   スクリプト: ${scriptName}`);
    console.log(`   予想時間: ${expectedMinutes}分`);

    const stepStart = Date.now();
    
    try {
      await this.runScript(scriptName);
      
      const stepTime = Date.now() - stepStart;
      const actualMinutes = Math.round(stepTime / 1000 / 60 * 10) / 10;
      
      this.stats.steps.push({
        name: description,
        script: scriptName,
        expectedMinutes,
        actualMinutes,
        success: true
      });
      
      console.log(`   ✅ ${description}完了: ${actualMinutes}分`);
      await this.logSuccess(description, actualMinutes);
      
    } catch (error) {
      const stepTime = Date.now() - stepStart;
      const actualMinutes = Math.round(stepTime / 1000 / 60 * 10) / 10;
      
      this.stats.steps.push({
        name: description,
        script: scriptName,
        expectedMinutes,
        actualMinutes,
        success: false,
        error: error.message
      });
      
      console.log(`   ❌ ${description}失敗: ${actualMinutes}分`);
      throw error;
    }
  }

  async runScript(scriptName) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptName], {
        cwd: __dirname,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${scriptName} failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  async generateFinalReport() {
    this.stats.endTime = new Date();
    this.stats.totalTime = this.stats.endTime - this.stats.startTime;
    
    console.log('\n📋 日次更新完了レポート');
    console.log('='.repeat(60));
    
    const totalMinutes = Math.round(this.stats.totalTime / 1000 / 60 * 10) / 10;
    console.log(`⏱️ 総処理時間: ${totalMinutes}分`);
    console.log(`🕐 開始時刻: ${this.stats.startTime.toLocaleString('ja-JP')}`);
    console.log(`🕐 終了時刻: ${this.stats.endTime.toLocaleString('ja-JP')}`);
    
    console.log('\n📊 ステップ別実績:');
    this.stats.steps.forEach((step, i) => {
      const status = step.success ? '✅' : '❌';
      const variance = step.actualMinutes - step.expectedMinutes;
      const varianceText = variance > 0 ? `+${variance.toFixed(1)}分` : `${variance.toFixed(1)}分`;
      
      console.log(`   ${i+1}. ${status} ${step.name}: ${step.actualMinutes}分 (予想差: ${varianceText})`);
    });

    const allSuccess = this.stats.steps.every(step => step.success);
    
    if (allSuccess) {
      console.log('\n🎉 全ステップ成功 - ポイ速データ更新完了');
      console.log('💡 次回実行まで待機（24時間後または手動実行）');
    } else {
      console.log('\n⚠️ 一部ステップ失敗 - ログを確認してください');
    }

    // ログファイルに記録
    await this.saveLogFile();
  }

  async ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    await fs.mkdir(logDir, { recursive: true });
  }

  async logSuccess(description, minutes) {
    const logEntry = `[${new Date().toISOString()}] SUCCESS: ${description} completed in ${minutes} minutes\n`;
    await fs.appendFile(this.logFile, logEntry);
  }

  async logError(error) {
    const logEntry = `[${new Date().toISOString()}] ERROR: ${error.message}\n${error.stack}\n`;
    await fs.appendFile(this.logFile, logEntry);
  }

  async saveLogFile() {
    const logData = {
      timestamp: this.stats.endTime.toISOString(),
      totalMinutes: Math.round(this.stats.totalTime / 1000 / 60 * 10) / 10,
      steps: this.stats.steps,
      success: this.stats.steps.every(step => step.success)
    };

    const logJson = JSON.stringify(logData, null, 2);
    const jsonLogFile = this.logFile.replace('.log', '.json');
    await fs.writeFile(jsonLogFile, logJson);
  }
}

// 実行
async function main() {
  const updater = new DailyCompleteUpdate();
  
  try {
    await updater.execute();
    console.log('\n🎯 日次更新システム完了');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 日次更新システム失敗:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DailyCompleteUpdate;