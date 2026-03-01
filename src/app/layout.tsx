'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './globals.css';

const NAV = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/smart-search', icon: '💬', label: 'Smart Search' },
  { href: '/vin', icon: '🧠', label: 'VIN Intelligence' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const current = NAV.find(n => n.href === path);

  return (
    <html lang="es">
      <head>
        <title>Movitty Advisor Platform</title>
        <meta name="description" content="Plataforma de inteligencia vehicular para advisors de Movitty" />
      </head>
      <body>
        <div className="app-shell">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-logo">
              <div className="logo-mark">M</div>
              <span className="logo-text">Movitty</span>
            </div>
            <nav className="sidebar-nav">
              <span className="nav-label">Herramientas</span>
              {NAV.map(n => (
                <Link key={n.href} href={n.href} className={`nav-link${path === n.href ? ' active' : ''}`}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="sidebar-footer">
              Powered by Marketcheck API<br />
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Feb 2026</span>
            </div>
          </aside>

          {/* Header */}
          <header className="app-header">
            <div>
              <div className="header-title">{current?.label ?? 'Movitty'}</div>
              <div className="header-sub">Advisor Platform</div>
            </div>
            <div className="header-badge">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              API Conectada
            </div>
          </header>

          {/* Page content */}
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
