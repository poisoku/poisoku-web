-- 検索回数をインクリメントする関数
CREATE OR REPLACE FUNCTION increment_search_count(search_keyword TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO search_history (keyword, search_count, last_searched_at)
  VALUES (search_keyword, 1, NOW())
  ON CONFLICT (keyword)
  DO UPDATE SET
    search_count = search_history.search_count + 1,
    last_searched_at = NOW();
END;
$$ LANGUAGE plpgsql;