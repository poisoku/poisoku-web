# 動的インポート問題回避ガイドライン

## 問題の背景

Vercel環境（特に静的サイト生成 `output: 'export'`）では、クライアントサイドでの動的インポート（`await import()`）が失敗することがある。

## 根本原因

1. **静的サイト生成の制約**: `output: 'export'` モードではランタイム動的インポートが制限される
2. **バンドル最適化**: Vercelのビルド時最適化が動的インポートパスを解決できない場合がある
3. **ESM/CommonJSの混在**: モジュール形式の不整合

## 対策ルール

### ❌ 避けるべきパターン

```typescript
// クライアントサイドでの動的インポート
const { someFunction } = await import('@/lib/someModule');

// 条件付き動的インポート
if (typeof window !== 'undefined') {
  const module = await import('@/lib/clientModule');
}

// 遅延読み込みでの動的インポート
useEffect(() => {
  import('@/lib/heavyModule').then(module => {
    // 処理
  });
}, []);
```

### ✅ 推奨パターン

```typescript
// 静的インポート（トップレベル）
import { someFunction } from '@/lib/someModule';

// Next.js dynamic importを使用（コンポーネントのみ）
import dynamic from 'next/dynamic';
const DynamicComponent = dynamic(() => import('@/components/HeavyComponent'));

// サーバーサイドでの動的インポート（API routes）
// app/api/example/route.ts
const { processData } = await import('@/lib/serverModule');
```

## 実装ベストプラクティス

### 1. ライブラリ関数の場合

```typescript
// ❌ 間違った実装
export async function useLibrary() {
  const { lib } = await import('@/lib/external');
  return lib;
}

// ✅ 正しい実装
import { lib } from '@/lib/external';
export function useLibrary() {
  return lib;
}
```

### 2. 重いライブラリの場合

```typescript
// ❌ クライアントサイドでの動的読み込み
useEffect(() => {
  import('heavy-chart-library').then(chart => {
    setChart(chart);
  });
}, []);

// ✅ 事前バンドル + 条件付きレンダリング
import dynamic from 'next/dynamic';
const ChartComponent = dynamic(() => import('@/components/Chart'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false
});
```

### 3. 環境依存コードの場合

```typescript
// ❌ 条件付き動的インポート
let storage;
if (typeof window !== 'undefined') {
  storage = await import('@/lib/localStorage');
}

// ✅ 静的インポート + ランタイム分岐
import { createStorage } from '@/lib/storage';
const storage = createStorage(); // 内部で環境判定
```

## 検証方法

### 1. ビルド時チェック
```bash
# 静的ビルドが成功することを確認
npm run build

# 動的インポートエラーの確認
grep -r "await import" src/
```

### 2. 実行時チェック
```typescript
// デバッグ用の検証コード
if (process.env.NODE_ENV === 'development') {
  console.log('Module loaded successfully:', module);
}
```

## 緊急時の対処法

### 1. 静的インポートへの変換
```typescript
// Before: 動的インポート
const { searchFunction } = await import('@/lib/search');

// After: 静的インポート
import { searchFunction } from '@/lib/search';
```

### 2. Next.js dynamic を使用
```typescript
// コンポーネントの場合
import dynamic from 'next/dynamic';
const SearchResults = dynamic(() => import('@/components/SearchResults'));
```

### 3. サーバーサイドへの移動
```typescript
// API route での処理に移動
// app/api/search/route.ts
export async function POST(request: Request) {
  const { searchLibrary } = await import('@/lib/search'); // サーバーサイドでは動作
  // 処理...
}
```

## 今回の事例から学ぶ教訓

1. **クライアントコンポーネントでは静的インポートを優先する**
2. **動的インポートはサーバーサイドまたはNext.js dynamic に限定する**
3. **ビルド時に必ずすべてのインポートパスを検証する**
4. **Vercel環境での動作確認を必須とする**

## チェックリスト

- [ ] 新機能開発時は静的インポートを最初に検討
- [ ] 動的インポートが必要な場合は代替手段を検討
- [ ] ビルド成功を確認してからデプロイ
- [ ] 本番環境での動作テストを実施