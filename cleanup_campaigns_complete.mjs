import { createClient } from '@supabase/supabase-js';

// Hardcode the environment variables from .env.local
const supabaseUrl = 'https://pjjhyzbnnslaauwzknrr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqamh5emJubnNsYWF1d3prbnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODg4MzksImV4cCI6MjA2NjU2NDgzOX0.qcrcwNpwX83dCNbhxFaks2E68K_wp2W8urdYwfenDtM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function cleanCampaignName(name) {
  let cleanedName = name;
  
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
  
  return cleanedName;
}

async function cleanupCampaigns() {
  console.log('Starting comprehensive campaign cleanup...\n');

  try {
    // 1. Get sample of campaigns with 楽天 before cleanup
    console.log('=== Sample of 楽天 campaigns BEFORE cleanup ===');
    const { data: beforeData, error: beforeError } = await supabase
      .from('campaigns')
      .select('id, name, cashback_rate, point_site_id')
      .ilike('name', '%楽天%')
      .order('name')
      .limit(15);

    if (beforeError) throw beforeError;
    
    console.table(beforeData?.map(c => ({ 
      name: c.name.substring(0, 50) + (c.name.length > 50 ? '...' : ''),
      cashback_rate: c.cashback_rate 
    })));

    // 2. Get all campaigns to process
    console.log('\nFetching all campaigns...');
    const { data: allCampaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name, point_site_id, device, cashback_rate');

    if (fetchError) throw fetchError;
    console.log(`Total campaigns fetched: ${allCampaigns.length}`);

    // 3. Process campaigns and identify duplicates
    const campaignMap = new Map();
    const toUpdate = [];
    const toDelete = [];

    for (const campaign of allCampaigns) {
      const cleanedName = cleanCampaignName(campaign.name);
      
      if (cleanedName.length < 2) {
        console.log(`Skipping campaign with too short name: ${campaign.id}`);
        continue;
      }

      const key = `${cleanedName}|${campaign.point_site_id}|${campaign.device}`;
      
      if (campaignMap.has(key)) {
        // This is a duplicate - mark for deletion
        toDelete.push(campaign.id);
      } else {
        // First occurrence - keep it
        campaignMap.set(key, campaign);
        
        // If name needs cleaning, mark for update
        if (cleanedName !== campaign.name) {
          toUpdate.push({
            id: campaign.id,
            cleanedName: cleanedName
          });
        }
      }
    }

    console.log(`\nCampaigns to update: ${toUpdate.length}`);
    console.log(`Duplicate campaigns to delete: ${toDelete.length}`);

    // 4. Delete duplicates first
    if (toDelete.length > 0) {
      console.log('\nDeleting duplicate campaigns...');
      const batchSize = 100;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('campaigns')
          .delete()
          .in('id', batch);
        
        if (deleteError) {
          console.error(`Error deleting batch: ${deleteError.message}`);
        } else {
          console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toDelete.length / batchSize)}`);
        }
      }
    }

    // 5. Update campaign names
    if (toUpdate.length > 0) {
      console.log('\nUpdating campaign names...');
      let updatedCount = 0;
      
      for (const { id, cleanedName } of toUpdate) {
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ name: cleanedName })
          .eq('id', id);

        if (updateError) {
          console.error(`Failed to update campaign ${id}:`, updateError.message);
        } else {
          updatedCount++;
          if (updatedCount % 100 === 0) {
            console.log(`Updated ${updatedCount}/${toUpdate.length} campaigns...`);
          }
        }
      }
      
      console.log(`\nSuccessfully updated: ${updatedCount} campaigns`);
    }

    // 6. Get sample of campaigns with 楽天 after cleanup
    console.log('\n=== Sample of 楽天 campaigns AFTER cleanup ===');
    const { data: afterData, error: afterError } = await supabase
      .from('campaigns')
      .select('id, name, cashback_rate, point_site_id')
      .ilike('name', '%楽天%')
      .order('name')
      .limit(15);

    if (afterError) throw afterError;
    
    console.table(afterData?.map(c => ({ 
      name: c.name.substring(0, 50) + (c.name.length > 50 ? '...' : ''),
      cashback_rate: c.cashback_rate 
    })));

    // 7. Final statistics
    const { count: totalCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    const { data: uniqueNames } = await supabase
      .from('campaigns')
      .select('name, point_site_id')
      .order('name');

    const uniqueCount = new Set(uniqueNames?.map(c => `${c.name}|${c.point_site_id}`)).size;

    console.log('\n=== Final Statistics ===');
    console.log(`Total campaigns: ${totalCount}`);
    console.log(`Unique campaign names per site: ${uniqueCount}`);
    console.log(`Duplicates removed: ${toDelete.length}`);
    console.log(`Campaign names cleaned: ${toUpdate.length}`);

    // 8. Show some examples of cleaned names
    console.log('\n=== Examples of Cleaned Names ===');
    const examples = toUpdate.slice(0, 10);
    for (const { id, cleanedName } of examples) {
      const original = allCampaigns.find(c => c.id === id);
      if (original) {
        console.log(`Original: "${original.name.substring(0, 60)}..."`);
        console.log(`Cleaned:  "${cleanedName}"\n`);
      }
    }

  } catch (error) {
    console.error('Error executing cleanup:', error);
  }
}

// Execute the cleanup
cleanupCampaigns();