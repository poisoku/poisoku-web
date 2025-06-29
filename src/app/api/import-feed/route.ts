import { NextRequest, NextResponse } from 'next/server';
import { APIFeedImporter } from '@/lib/apiFeedImporter';

// API/フィードインポートエンドポイント
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedUrl, format = 'json' } = body;

    if (!feedUrl) {
      return NextResponse.json({ error: 'フィードURLが必要です' }, { status: 400 });
    }

    const importer = new APIFeedImporter();
    const result = await importer.importFromFeed(feedUrl, format);

    return NextResponse.json(result);

  } catch (error) {
    console.error('フィードインポートエラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}

// ダミーデータクリーンアップエンドポイント
export async function DELETE(request: NextRequest) {
  try {
    const importer = new APIFeedImporter();
    const result = await importer.cleanupDummyData();

    return NextResponse.json(result);

  } catch (error) {
    console.error('クリーンアップエラー:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}