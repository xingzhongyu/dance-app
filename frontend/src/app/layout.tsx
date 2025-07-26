import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header'; // 引入Header组件
import { AuthProvider } from '@/context/AuthContext';
import styles from '@/styles/Layout.module.css';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'H5AD Data Platform',
  description: 'Analyze spatial transcriptomics data',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          <div className={styles.layout}>
            <Header /> {/* 添加Header组件 */}
            <Sidebar />
            <main className={styles.mainContent}>
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}