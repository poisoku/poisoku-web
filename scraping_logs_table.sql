-- スクレイピングログテーブルの作成
-- 各スクレイピング実行の記録を保存

CREATE TABLE IF NOT EXISTS scraping_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name TEXT NOT NULL,
  search_keyword TEXT NOT NULL,
  campaigns_found INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT false,
  errors JSONB DEFAULT '[]'::jsonb,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_scraping_logs_site_name ON scraping_logs(site_name);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_scraped_at ON scraping_logs(scraped_at);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_success ON scraping_logs(success);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_search_keyword ON scraping_logs(search_keyword);

-- 古いログを定期的にクリーンアップするための関数
CREATE OR REPLACE FUNCTION cleanup_old_scraping_logs()
RETURNS void AS $$
BEGIN
  -- 90日より古いログを削除
  DELETE FROM scraping_logs 
  WHERE scraped_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- コメント追加
COMMENT ON TABLE scraping_logs IS 'スクレイピング実行ログ';
COMMENT ON COLUMN scraping_logs.site_name IS 'スクレイピング対象のポイントサイト名';
COMMENT ON COLUMN scraping_logs.search_keyword IS '検索キーワード';
COMMENT ON COLUMN scraping_logs.campaigns_found IS '取得できた案件数';
COMMENT ON COLUMN scraping_logs.success IS 'スクレイピング成功/失敗';
COMMENT ON COLUMN scraping_logs.errors IS 'エラー詳細（JSON配列）';
COMMENT ON COLUMN scraping_logs.scraped_at IS 'スクレイピング実行日時';
COMMENT ON COLUMN scraping_logs.processing_time_ms IS '処理時間（ミリ秒）';

-- サンプルデータの投入（テスト用）
INSERT INTO scraping_logs (site_name, search_keyword, campaigns_found, success, errors, scraped_at) VALUES
('ハピタス', 'Yahoo!ショッピング', 5, true, '[]'::jsonb, NOW() - INTERVAL '1 hour'),
('モッピー', 'Yahoo!ショッピング', 3, true, '[]'::jsonb, NOW() - INTERVAL '1 hour'),
('ハピタス', '楽天市場', 4, true, '[]'::jsonb, NOW() - INTERVAL '2 hours'),
('モッピー', '楽天市場', 2, false, '["タイムアウトエラー"]'::jsonb, NOW() - INTERVAL '2 hours'),
('ハピタス', 'Amazon', 1, true, '[]'::jsonb, NOW() - INTERVAL '3 hours');