-- ランキングスナップショットテーブルの作成
-- 1日4回の集計結果を保存して履歴を管理

CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rank INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  search_count INTEGER NOT NULL,
  top_campaign_id UUID REFERENCES campaigns(id),
  top_cashback_rate TEXT,
  top_site_name TEXT,
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_snapshot_at ON ranking_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_rank ON ranking_snapshots(rank);
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_keyword ON ranking_snapshots(keyword);

-- 古いスナップショットを定期的にクリーンアップするための関数
CREATE OR REPLACE FUNCTION cleanup_old_ranking_snapshots()
RETURNS void AS $$
BEGIN
  -- 30日より古いスナップショットを削除
  DELETE FROM ranking_snapshots 
  WHERE snapshot_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- コメント追加
COMMENT ON TABLE ranking_snapshots IS '検索ランキングの定期スナップショット（1日4回更新）';
COMMENT ON COLUMN ranking_snapshots.rank IS 'そのスナップショット時点での順位';
COMMENT ON COLUMN ranking_snapshots.keyword IS '検索キーワード';
COMMENT ON COLUMN ranking_snapshots.search_count IS 'そのスナップショット時点での検索回数';
COMMENT ON COLUMN ranking_snapshots.top_campaign_id IS 'そのキーワードでの最高還元率案件ID';
COMMENT ON COLUMN ranking_snapshots.top_cashback_rate IS '最高還元率';
COMMENT ON COLUMN ranking_snapshots.top_site_name IS '最高還元率のポイントサイト名';
COMMENT ON COLUMN ranking_snapshots.snapshot_at IS 'スナップショット取得日時';

-- サンプルデータの投入（テスト用）
INSERT INTO ranking_snapshots (rank, keyword, search_count, top_cashback_rate, top_site_name, snapshot_at) VALUES
(1, 'Yahoo!ショッピング', 150, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(2, '楽天市場', 120, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(3, 'Amazon', 95, '0.5%', 'モッピー', NOW() - INTERVAL '6 hours'),
(4, 'じゃらん', 80, '2.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(5, 'ZOZOTOWN', 70, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(6, 'ふるさと納税', 65, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(7, 'セブンネット', 60, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(8, 'イオンネットスーパー', 55, '0.5%', 'モッピー', NOW() - INTERVAL '6 hours'),
(9, 'ヨドバシカメラ', 50, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours'),
(10, 'ビックカメラ', 45, '1.0%', 'ハピタス', NOW() - INTERVAL '6 hours');