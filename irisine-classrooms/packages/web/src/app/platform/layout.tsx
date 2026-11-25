'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { clearSession } from '@/lib/api';

/** Platform owner area. Only a platform login may open it; the API enforces this again on every call. */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const token = localStorage.getItem('accessToken');
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (!token || user?.portal !== 'PLATFORM') {
        router.replace('/platform-login');
        return;
      }
      setName(user.name || user.email);
      setReady(true);
    } catch {
      router.replace('/platform-login');
    }
  }, [router]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <Link href="/platform" className="flex items-center gap-3">
            <BrandLogo size={32} />
            <span className="text-sm font-semibold text-muted-foreground">Platform</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{name}</span>
            <ThemeToggle />
            <button
              onClick={() => { clearSession(); router.replace('/platform-login'); }}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
