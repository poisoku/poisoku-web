import { createClient } from '@supabase/supabase-js';

// Hardcode the environment variables from .env.local
const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executeCleanup() {
  console.log('Starting campaign name cleanup...\n');

  try {
    // 1. Get sample of campaigns with 楽天 before cleanup
    console.log('=== Sample of 楽天 campaigns BEFORE cleanup ===');
    const { data: beforeData, error: beforeError } = await supabase
      .from('campaigns')
      .select('id, name, cashback_rate, point_site_id')
      .ilike('name', '%楽天%')
      .limit(10);

    if (beforeError) throw beforeError;
    
    console.table(beforeData?.map(c => ({ 
      name: c.name.substring(0, 50) + (c.name.length > 50 ? '...' : ''),
      cashback_rate: c.cashback_rate 
    })));

    // 2. Count campaigns that will be updated
    const { count: updateCount, error: countError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .or(`name.ilike.%[0-9]%P%,name.ilike.%[0-9]%円%,name.ilike.%[0-9]%ポイント%,name.ilike.%[0-9]%pt%,name.ilike.%[0-9]%%,name.ilike.%[0-9]%％%,name.ilike.%【%】%,name.ilike.%(%）%,name.ilike.%最大%,name.ilike.%倍%,name.ilike.%up to%`);

    if (countError) throw countError;
    console.log(`\nCampaigns to be updated: ${updateCount}\n`);

    // 3. Execute the cleanup
    console.log('Executing cleanup SQL...');
    
    // First, let's get all campaigns that match our criteria
    const { data: campaignsToUpdate, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name')
      .or(`name.ilike.%[0-9]%P%,name.ilike.%[0-9]%円%,name.ilike.%[0-9]%ポイント%,name.ilike.%[0-9]%pt%,name.ilike.%[0-9]%%,name.ilike.%[0-9]%％%,name.ilike.%【%】%,name.ilike.%(%）%,name.ilike.%最大%,name.ilike.%倍%,name.ilike.%up to%`);

    if (fetchError) throw fetchError;

    // Process each campaign
    let updatedCount = 0;
    for (const campaign of campaignsToUpdate) {
      let cleanedName = campaign.name;
      
      // Apply all the regex replacements
      cleanedName = cleanedName.replace(/\s+/g, ' '); // Multiple spaces to one
      cleanedName = cleanedName.replace(/[\n\t]+/g, ' '); // Newlines and tabs to space
      cleanedName = cleanedName.replace(/【[^】]*】/g, ''); // Remove 【】 content
      cleanedName = cleanedName.replace(/\([^)]*\)/g, ''); // Remove () content
      cleanedName = cleanedName.replace(/\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, ''); // Remove rates
      cleanedName = cleanedName.replace(/\s*-\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, ''); // Remove rates with hyphen
      cleanedName = cleanedName.replace(/\s*:\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, ''); // Remove rates with colon
      cleanedName = cleanedName.replace(/\s*～\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, ''); // Remove rates with wave
      cleanedName = cleanedName.replace(/\s*最大\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/g, ''); // Remove 最大〇〇P
      cleanedName = cleanedName.replace(/\s*[Uu]p\s*[Tt]o\s*[\d,，]+\.?\d*[P円ポイントpt%％]\s*/gi, ''); // Remove up to
      cleanedName = cleanedName.replace(/\s*\d+\.?\d*\s*倍\s*/g, ''); // Remove 〇倍
      cleanedName = cleanedName.replace(/\s+/g, ' '); // Normalize spaces again
      cleanedName = cleanedName.trim();

      // Update if the name changed
      if (cleanedName !== campaign.name && cleanedName.length >= 2) {
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ name: cleanedName })
          .eq('id', campaign.id);

        if (updateError) {
          console.error(`Failed to update campaign ${campaign.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`\nActually updated: ${updatedCount} campaigns\n`);

    // 4. Get sample of campaigns with 楽天 after cleanup
    console.log('=== Sample of 楽天 campaigns AFTER cleanup ===');
    const { data: afterData, error: afterError } = await supabase
      .from('campaigns')
      .select('id, name, cashback_rate, point_site_id')
      .ilike('name', '%楽天%')
      .limit(10);

    if (afterError) throw afterError;
    
    console.table(afterData?.map(c => ({ 
      name: c.name.substring(0, 50) + (c.name.length > 50 ? '...' : ''),
      cashback_rate: c.cashback_rate 
    })));

    // 5. Check for empty or short names
    const { count: shortNamesCount, error: shortError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .lt('char_length(name)', 2);

    if (shortError) throw shortError;
    console.log(`\nCampaigns with empty or very short names: ${shortNamesCount}`);

    // 6. Get statistics
    const { count: totalCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    const { count: cleanCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .not('name', 'ilike', '%[0-9]%P%')
      .not('name', 'ilike', '%[0-9]%円%')
      .not('name', 'ilike', '%[0-9]%ポイント%')
      .not('name', 'ilike', '%[0-9]%pt%')
      .not('name', 'ilike', '%[0-9]%%')
      .not('name', 'ilike', '%[0-9]%％%')
      .not('name', 'ilike', '%【%】%')
      .not('name', 'ilike', '%(%）%')
      .not('name', 'ilike', '%最大%')
      .not('name', 'ilike', '%倍%')
      .not('name', 'ilike', '%up to%');

    console.log('\n=== Final Statistics ===');
    console.log(`Total campaigns: ${totalCount}`);
    console.log(`Campaigns with clean names: ${cleanCount}`);
    console.log(`Campaigns updated: ${updatedCount}`);

    // 7. Check for potential duplicates after cleanup
    console.log('\n=== Checking for potential duplicates ===');
    const { data: allCampaigns } = await supabase
      .from('campaigns')
      .select('name, point_site_id')
      .order('name');

    const nameCount = {};
    allCampaigns?.forEach(c => {
      const key = `${c.name}|${c.point_site_id}`;
      nameCount[key] = (nameCount[key] || 0) + 1;
    });

    const duplicates = Object.entries(nameCount)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (duplicates.length > 0) {
      console.log('Top duplicate campaign names (name | point_site_id : count):');
      duplicates.forEach(([key, count]) => {
        console.log(`  ${key} : ${count}`);
      });
    } else {
      console.log('No duplicate campaign names found!');
    }

  } catch (error) {
    console.error('Error executing cleanup:', error);
  }
}

// Execute the cleanup
executeCleanup();