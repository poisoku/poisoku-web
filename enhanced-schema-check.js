const { createClient } = require('@supabase/supabase-js');

async function enhancedSchemaCheck() {
  console.log('🔍 Enhanced Supabase Schema Analysis...\n');
  
  const supabase = createClient(
    'https://pjjhyzbnnslaauwzknrr.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM'
  );

  try {
    // 1. Check table structure
    console.log('📋 Step 1: Checking campaigns table structure...');
    const { data: sampleCampaign, error: structureError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);

    if (structureError) {
      console.error('❌ Error fetching table structure:', structureError);
      return;
    }

    if (sampleCampaign.length > 0) {
      console.log('✅ Available columns in campaigns table:');
      Object.keys(sampleCampaign[0]).forEach((key, index) => {
        console.log(`   ${index + 1}. ${key}`);
      });
      
      const hasCategory = 'category' in sampleCampaign[0];
      console.log(`\n🎯 Category column exists: ${hasCategory ? '✅ YES' : '❌ NO'}`);
    }

    // 2. Check PointIncome campaigns
    console.log('\n📊 Step 2: Analyzing PointIncome campaigns...');
    const { data: pointincomeData, error: pointincomeError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('site', 'PointIncome')
      .limit(10);

    if (pointincomeError) {
      console.error('❌ Error fetching PointIncome data:', pointincomeError);
    } else {
      console.log(`✅ Found ${pointincomeData.length} PointIncome campaigns (showing first 10)`);
      pointincomeData.forEach((campaign, index) => {
        console.log(`\n   Campaign ${index + 1}:`);
        console.log(`   - ID: ${campaign.id}`);
        console.log(`   - Name: ${campaign.name}`);
        console.log(`   - URL: ${campaign.url}`);
        console.log(`   - Device: ${campaign.device || 'N/A'}`);
        console.log(`   - Category: ${campaign.category || 'N/A'}`);
        console.log(`   - Cashback: ${campaign.cashback}`);
      });
    }

    // 3. Device and category statistics
    console.log('\n📈 Step 3: Device and category statistics...');
    
    // Device statistics
    const { data: deviceStats, error: deviceError } = await supabase
      .from('campaigns')
      .select('device')
      .eq('site', 'PointIncome');

    if (!deviceError && deviceStats) {
      const deviceCounts = deviceStats.reduce((acc, item) => {
        const device = item.device || 'Unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📱 Device distribution for PointIncome:');
      Object.entries(deviceCounts).forEach(([device, count]) => {
        console.log(`   - ${device}: ${count} campaigns`);
      });
    }

    // Category statistics (if column exists)
    if (sampleCampaign.length > 0 && 'category' in sampleCampaign[0]) {
      const { data: categoryStats, error: categoryError } = await supabase
        .from('campaigns')
        .select('category')
        .eq('site', 'PointIncome');

      if (!categoryError && categoryStats) {
        const categoryCounts = categoryStats.reduce((acc, item) => {
          const category = item.category || 'Unknown';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});
        
        console.log('\n🏷️ Category distribution for PointIncome:');
        Object.entries(categoryCounts).forEach(([category, count]) => {
          console.log(`   - ${category}: ${count} campaigns`);
        });
      }
    }

    // 4. Check for mobile app campaigns
    console.log('\n📱 Step 4: Checking for mobile app campaigns...');
    
    const { data: mobileApps, error: mobileError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('site', 'PointIncome')
      .or('device.eq.Android,device.eq.iOS,device.eq.mobile,name.ilike.%アプリ%,name.ilike.%app%');

    if (!mobileError && mobileApps) {
      console.log(`📲 Found ${mobileApps.length} potential mobile app campaigns:`);
      mobileApps.slice(0, 5).forEach((app, index) => {
        console.log(`\n   App ${index + 1}:`);
        console.log(`   - Name: ${app.name}`);
        console.log(`   - Device: ${app.device || 'N/A'}`);
        console.log(`   - Category: ${app.category || 'N/A'}`);
        console.log(`   - URL: ${app.url}`);
      });
    }

    // 5. Total campaigns count
    console.log('\n📊 Step 5: Total campaigns summary...');
    const { count: totalCount, error: countError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    const { count: pointincomeCount, error: piCountError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('site', 'PointIncome');

    if (!countError && !piCountError) {
      console.log(`📈 Total campaigns in database: ${totalCount}`);
      console.log(`🎯 PointIncome campaigns: ${pointincomeCount}`);
      console.log(`📊 PointIncome percentage: ${((pointincomeCount / totalCount) * 100).toFixed(1)}%`);
    }

    console.log('\n✅ Schema analysis complete!');

  } catch (error) {
    console.error('❌ Connection error:', error);
  }
}

enhancedSchemaCheck();