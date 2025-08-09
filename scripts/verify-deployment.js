#!/usr/bin/env node

/**
 * Verify local and deployed search data consistency
 */

const fs = require('fs');
const https = require('https');

async function fetchRemoteData() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://poisoku.jp/search-data.json?v=' + Date.now(), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function verifyDeployment() {
  console.log('🔍 Deployment verification starting...');
  
  // Local data
  const localPath = '/Users/kn/poisoku-web/public/search-data.json';
  const localData = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
  
  console.log(`📊 Local data: ${localData.campaigns.length} campaigns`);
  
  const localSiteCount = {};
  localData.campaigns.forEach(c => {
    localSiteCount[c.siteName] = (localSiteCount[c.siteName] || 0) + 1;
  });
  
  console.log('📊 Local site breakdown:');
  Object.entries(localSiteCount).forEach(([site, count]) => {
    console.log(`   ${site}: ${count}`);
  });
  
  // Remote data
  try {
    console.log('\n🌐 Fetching remote data...');
    const remoteData = await fetchRemoteData();
    
    console.log(`📊 Remote data: ${remoteData.campaigns.length} campaigns`);
    
    const remoteSiteCount = {};
    remoteData.campaigns.forEach(c => {
      remoteSiteCount[c.siteName] = (remoteSiteCount[c.siteName] || 0) + 1;
    });
    
    console.log('📊 Remote site breakdown:');
    Object.entries(remoteSiteCount).forEach(([site, count]) => {
      console.log(`   ${site}: ${count}`);
    });
    
    // Comparison
    console.log('\n🔍 Comparison:');
    console.log(`Total campaigns: Local ${localData.campaigns.length} vs Remote ${remoteData.campaigns.length}`);
    
    if (localData.campaigns.length === remoteData.campaigns.length) {
      console.log('✅ Campaign counts match!');
    } else {
      console.log('❌ Campaign counts do not match!');
    }
    
    const hasPointIncomeLocal = localSiteCount['ポイントインカム'] || 0;
    const hasPointIncomeRemote = remoteSiteCount['ポイントインカム'] || 0;
    
    console.log(`PointIncome campaigns: Local ${hasPointIncomeLocal} vs Remote ${hasPointIncomeRemote}`);
    
    if (hasPointIncomeRemote > 0) {
      console.log('✅ PointIncome data is live!');
    } else {
      console.log('❌ PointIncome data not deployed yet');
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch remote data:', error.message);
  }
}

verifyDeployment().catch(console.error);