import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: pointSites, error } = await supabase
      .from('point_sites')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw error;
    }

    return NextResponse.json(pointSites || []);
  } catch (error) {
    console.error('ポイントサイト取得エラー:', error);
    return NextResponse.json({ error: 'ポイントサイトの取得に失敗しました' }, { status: 500 });
  }
}