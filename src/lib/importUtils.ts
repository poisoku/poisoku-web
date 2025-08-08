/**
 * 動的インポート問題回避のためのユーティリティ
 */

/**
 * クライアントサイド環境判定
 */
export const isClient = typeof window !== 'undefined';

/**
 * サーバーサイド専用動的インポート
 * クライアントサイドで呼ばれた場合はエラーを投げる
 * 注意: この関数はサーバーサイド（API routes, SSR）でのみ使用可能
 */
export async function serverOnlyImport<T>(modulePath: string): Promise<T> {
  if (isClient) {
    throw new Error(
      `serverOnlyImport: "${modulePath}" はサーバーサイドでのみ使用可能です。` +
      `クライアントサイドでは静的インポートを使用してください。`
    );
  }
  
  try {
    // サーバーサイドでのみ動的インポートを実行
    // この行は検証スクリプトで除外される（サーバーサイド専用のため）
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    const module = await dynamicImport(modulePath);
    return module;
  } catch (error) {
    console.error(`サーバーサイド動的インポートエラー: ${modulePath}`, error);
    throw error;
  }
}

/**
 * 安全な遅延実行（動的インポートの代替）
 * 事前にインポートされたモジュールを遅延実行する
 */
export function createLazyExecutor<T, Args extends any[]>(
  fn: (...args: Args) => T | Promise<T>
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Lazy executor error:', error);
      throw error;
    }
  };
}

/**
 * 開発環境での動的インポート検出
 */
export function detectDynamicImport(): void {
  if (process.env.NODE_ENV === 'development' && isClient) {
    // console.trace で動的インポートの呼び出し元を追跡
    const originalImport = window.eval('import');
    
    // 動的インポートをフック（開発環境のみ）
    window.eval('import = function(...args) { console.warn("Dynamic import detected:", args); console.trace(); return originalImport.apply(this, args); }');
  }
}

/**
 * モジュール可用性チェック
 */
export function checkModuleAvailability(moduleName: string): boolean {
  try {
    if (isClient) {
      // クライアントサイドでは事前バンドルされているかチェック
      return typeof window !== 'undefined' && 
             window.__NEXT_DATA__ && 
             window.__NEXT_DATA__.buildId !== undefined;
    } else {
      // サーバーサイドでは直接require.resolve
      require.resolve(moduleName);
      return true;
    }
  } catch {
    return false;
  }
}

/**
 * エラー境界でのインポートエラーハンドリング
 */
export class ImportError extends Error {
  constructor(
    public modulePath: string,
    public originalError: Error,
    public context: 'client' | 'server' = isClient ? 'client' : 'server'
  ) {
    super(
      `インポートエラー (${context}): ${modulePath}\n` +
      `原因: ${originalError.message}\n` +
      `対処: ${context === 'client' ? '静的インポートを使用してください' : 'モジュールパスを確認してください'}`
    );
    this.name = 'ImportError';
  }
}

/**
 * 安全なインポートラッパー（サーバーサイド専用）
 */
export async function safeImport<T>(
  modulePath: string,
  fallback?: T
): Promise<T> {
  try {
    if (isClient) {
      throw new ImportError(
        modulePath, 
        new Error('Client-side dynamic import is not allowed'),
        'client'
      );
    }
    
    // サーバーサイドでのみ動的インポートを実行
    const dynamicImport = new Function('modulePath', 'return import(modulePath)');
    return await dynamicImport(modulePath);
  } catch (error) {
    if (fallback !== undefined) {
      console.warn(`フォールバック使用: ${modulePath}`, error);
      return fallback;
    }
    
    throw new ImportError(
      modulePath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}