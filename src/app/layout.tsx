import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CacheManager from "../components/CacheManager";
import SafeImportWrapper from '@/components/SafeImportWrapper';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ポイ速 - ポイントサイト案件比較検索",
  description: "ポイントサイトの案件を一括検索・比較できるサービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="cache-control" content="no-cache, no-store, must-revalidate" />
        <meta name="pragma" content="no-cache" />
        <meta name="expires" content="0" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SafeImportWrapper
          onError={(error) => {
            // 本番環境でのエラーログ
            if (process.env.NODE_ENV === 'production') {
              console.error('Production import error:', error);
            }
          }}
        >
          {children}
        </SafeImportWrapper>
        <CacheManager />
      </body>
    </html>
  );
}
