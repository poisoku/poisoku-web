# ポイ速 自動監視システム デプロイ方法

## 現在の実装状況

### 自動監視システム（GitHub Actions実装済み）

#### 1. アプリランド案件専用監視
✅ **完成済み**: `appliland-monitoring-system.js`
✅ **自動実行**: 毎日18:00 JST (.github/workflows/appliland-monitor.yml)
✅ **対象**: アプリランド案件のみ（約75件）

#### 2. ちょびリッチ全案件監視
✅ **完成済み**: `chobirich-differential-system.js`
✅ **自動実行**: 毎日19:00 JST (.github/workflows/chobirich-full-monitor.yml)
✅ **対象**: iOS/Android全案件（3,000件以上）

## 実用的なデプロイ選択肢

### 1. GitHub Actions (推奨 - 無料)
```yaml
# .github/workflows/appliland-monitor.yml
name: Appliland Monitor
on:
  schedule:
    - cron: '0 9 * * *'  # 毎日9時に実行
  workflow_dispatch:      # 手動実行も可能
    
jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/appliland-monitoring-system.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
      - name: Regenerate search data if new campaigns found
        run: node scripts/generate-search-data.js
      - name: Commit and push changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add -A
          git diff --staged --quiet || git commit -m "Auto-update: New Appliland campaigns detected"
          git push
```

### 2. Vercel Cron Jobs (有料 - Pro以上)
```javascript
// api/cron/monitor-appliland.js
import { ApplilandMonitoringSystem } from '../../scripts/appliland-monitoring-system.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const monitor = new ApplilandMonitoringSystem();
  await monitor.monitorNewApplilandCampaigns();
  
  res.status(200).json({ status: 'completed' });
}
```

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/monitor-appliland",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 3. 手動実行 (現在可能)
```bash
# 毎日手動で実行
node scripts/appliland-monitoring-system.js
node scripts/generate-search-data.js  # 新規案件があった場合
git add . && git commit -m "Update campaigns" && git push
```

### 4. VPS/クラウドサーバー (有料)
```bash
# crontab設定例
0 9 * * * cd /path/to/poisoku-web && node scripts/appliland-monitoring-system.js
5 9 * * * cd /path/to/poisoku-web && node scripts/generate-search-data.js
```

## 推奨実装順序

### Phase 1: 手動運用 (今すぐ可能)
1. 週1-2回の手動実行
2. 新規案件発見時のみ検索データ更新

### Phase 2: GitHub Actions (推奨)
1. 無料で自動実行可能
2. 毎日定時実行
3. 新規案件発見時の自動デプロイ

### Phase 3: 高度な監視 (将来)
1. リアルタイム監視
2. Slack/Discord通知
3. 高額案件の即座通知

## 現在の状況まとめ

**✅ できること**:
- 新規アプリランド案件の自動検出・追加
- 手動実行での確実な監視

**❌ まだできないこと**:
- 完全自動の24時間監視
- 新規案件の即座通知

**💡 次のステップ**:
GitHub Actionsの実装が最もコスト効率的で実用的です。