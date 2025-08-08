#!/usr/bin/env node

/**
 * 動的インポート検証スクリプト
 * ビルド前に危険な動的インポートパターンを検出
 */

const fs = require('fs');
const path = require('path');

// 検索対象ディレクトリ
const srcDir = path.join(__dirname, '../src');

// 危険なパターン
const DANGEROUS_PATTERNS = [
  {
    pattern: /await\s+import\s*\(/g,
    message: 'クライアントサイドでの await import() は避けてください',
    severity: 'error',
    // サーバーサイド専用関数内は除外
    exclude: /\/\*\*[\s\S]*?サーバーサイド専用[\s\S]*?\*\//
  },
  {
    pattern: /import\s*\([^)]*\$\{/g,
    message: '動的なインポートパスは避けてください',
    severity: 'error'
  },
  {
    pattern: /useEffect\s*\([^}]*import\s*\(/g,
    message: 'useEffect内での動的インポートは避けてください',
    severity: 'warning'
  },
  {
    pattern: /require\s*\([^)]*\)/g,
    message: 'ESモジュール環境でのrequire()使用は避けてください',
    severity: 'warning'
  }
];

// 除外ファイル・ディレクトリ
const EXCLUDED = [
  'node_modules',
  '.next',
  'out',
  '.git',
  'scripts',
  'eslint.config.js',
  'next.config.ts'
];

/**
 * ファイルを再帰的にスキャン
 */
function scanDirectory(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !EXCLUDED.includes(entry.name)) {
      scanDirectory(fullPath, results);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  
  return results;
}

/**
 * ファイル内の危険なパターンをチェック
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const issues = [];
  
  for (const { pattern, message, severity, exclude } of DANGEROUS_PATTERNS) {
    let match;
    let lineNumber = 1;
    const lines = content.split('\n');
    
    // 除外パターンがある場合、ファイル全体をチェック
    let isExcluded = false;
    if (exclude && exclude.test(content)) {
      isExcluded = true;
    }
    
    // 除外されたファイルはスキップ
    if (isExcluded) {
      continue;
    }
    
    // 各行をチェック
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      pattern.lastIndex = 0; // RegExpのリセット
      
      if (pattern.test(line)) {
        issues.push({
          file: relativePath,
          line: i + 1,
          message,
          severity,
          code: line.trim()
        });
      }
    }
  }
  
  return issues;
}

/**
 * メイン実行
 */
function main() {
  console.log('🔍 動的インポート検証を開始...\n');
  
  const files = scanDirectory(srcDir);
  const allIssues = [];
  
  for (const file of files) {
    const issues = checkFile(file);
    allIssues.push(...issues);
  }
  
  // 結果のレポート
  if (allIssues.length === 0) {
    console.log('✅ 危険な動的インポートは見つかりませんでした\n');
    process.exit(0);
  }
  
  // 重要度別に集計
  const errors = allIssues.filter(issue => issue.severity === 'error');
  const warnings = allIssues.filter(issue => issue.severity === 'warning');
  
  console.log(`⚠️  ${allIssues.length}個の問題が見つかりました:\n`);
  
  // エラーの表示
  if (errors.length > 0) {
    console.log('🚫 エラー (修正必須):');
    for (const issue of errors) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}`);
      console.log(`    > ${issue.code}\n`);
    }
  }
  
  // 警告の表示
  if (warnings.length > 0) {
    console.log('⚠️  警告 (修正推奨):');
    for (const issue of warnings) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}`);
      console.log(`    > ${issue.code}\n`);
    }
  }
  
  // 修正案の提示
  console.log('💡 修正案:');
  console.log('  1. await import() → 静的 import 文に変更');
  console.log('  2. 動的パス → 固定パスに変更');
  console.log('  3. useEffect内のimport → 静的importまたはNext.js dynamic使用');
  console.log('  4. require() → import 文に変更');
  console.log('\n詳細は DYNAMIC_IMPORT_GUIDELINES.md を参照してください。\n');
  
  // エラーがある場合はビルドを停止
  if (errors.length > 0) {
    console.log('❌ エラーが存在するためビルドを停止します');
    process.exit(1);
  } else {
    console.log('✅ 警告はありますが、ビルドを続行します');
    process.exit(0);
  }
}

main();