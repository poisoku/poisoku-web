'use client';

import { useState, useEffect, ReactNode } from 'react';
import { ImportError } from '@/lib/importUtils';

interface SafeImportWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

/**
 * インポートエラーを安全に処理するラッパーコンポーネント
 */
export default function SafeImportWrapper({ 
  children, 
  fallback = <div>コンテンツの読み込み中...</div>,
  onError
}: SafeImportWrapperProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // グローバルエラーハンドラー
    const handleError = (event: ErrorEvent) => {
      if (event.error instanceof ImportError) {
        console.error('Import error caught:', event.error);
        setError(event.error);
        setHasError(true);
        onError?.(event.error);
        event.preventDefault();
      }
    };

    // プロミスエラーハンドラー
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof ImportError) {
        console.error('Import promise rejection caught:', event.reason);
        setError(event.reason);
        setHasError(true);
        onError?.(event.reason);
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [onError]);

  if (hasError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">
          モジュールの読み込みに失敗しました
        </h3>
        <p className="text-red-600 text-sm mb-4">
          {error?.message || '不明なエラーが発生しました'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            ページを再読み込み
          </button>
          <button
            onClick={() => {
              setHasError(false);
              setError(null);
            }}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
          >
            再試行
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-4">
            <summary className="text-red-600 cursor-pointer">
              開発者向け詳細情報
            </summary>
            <pre className="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }

  try {
    return <>{children}</>;
  } catch (error) {
    if (error instanceof ImportError) {
      setError(error);
      setHasError(true);
      return fallback;
    }
    throw error; // 他のエラーは再スロー
  }
}