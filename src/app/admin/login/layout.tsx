import type { Metadata } from 'next';
import '../admin.css';

export const metadata: Metadata = {
  title: 'Admin Login — Toriq Tools CMS',
  description: 'Sign in to the Toriq Tools content management system.',
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
