import type { Metadata } from 'next';
import './globals.css';
import './redesign.css';
export const metadata: Metadata = { title: 'Our Taiwan 2026 | 둘이 떠나는 대만', description: '2026.11.18–22 · 타이베이와 우라이, 두 사람의 여행 수첩', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }
