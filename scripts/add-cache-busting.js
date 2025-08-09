#!/usr/bin/env node

/**
 * Add cache busting timestamp to search data files
 */

const fs = require('fs');
const path = require('path');

async function addCacheBusting() {
  console.log('🔄 Adding cache busting to search data...');
  
  const timestamp = Date.now();
  
  // Read current search data
  const searchDataPath = '/Users/kn/poisoku-web/public/search-data.json';
  const searchData = JSON.parse(fs.readFileSync(searchDataPath, 'utf-8'));
  
  // Add cache busting metadata
  searchData.metadata = {
    ...searchData.metadata,
    cacheTimestamp: timestamp,
    deployVersion: new Date().toISOString()
  };
  
  console.log(`📊 Total campaigns: ${searchData.campaigns.length}`);
  
  // Count by site
  const siteCount = {};
  searchData.campaigns.forEach(c => {
    siteCount[c.siteName] = (siteCount[c.siteName] || 0) + 1;
  });
  
  console.log('📊 Site breakdown:');
  Object.entries(siteCount).forEach(([site, count]) => {
    console.log(`   ${site}: ${count}`);
  });
  
  // Save with cache busting
  fs.writeFileSync(searchDataPath, JSON.stringify(searchData, null, 2));
  
  console.log(`✅ Cache busting added: ${timestamp}`);
}

addCacheBusting().catch(console.error);