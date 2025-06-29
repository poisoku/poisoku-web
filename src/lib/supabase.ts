import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// データベースの型定義
export interface PointSite {
  id: string;
  name: string;
  url: string;
  category: 'major' | 'gaming' | 'survey' | 'cashback';
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  point_site_id: string;
  cashback_rate: string;
  device: 'PC' | 'iOS' | 'Android' | 'All' | 'iOS/Android';
  campaign_url: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchHistory {
  id: string;
  keyword: string;
  search_count: number;
  last_searched_at: string;
  created_at: string;
}

export interface CashbackHistory {
  id: string;
  campaign_id: string;
  cashback_rate: string;
  recorded_at: string;
}