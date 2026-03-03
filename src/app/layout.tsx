'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './globals.css';

const NAV = [
  { href: '/', icon: 'dashboard', label: 'Dashboard' },
  { href: '/smart-search', icon: 'directions_car', label: 'Smart Search' },
  { href: '/vin', icon: 'barcode_scanner', label: 'VIN Intelligence' },
  { href: '/compare', icon: 'compare_arrows', label: 'Compare (Radar)' },
  { href: '/watchlist', icon: 'favorite', label: 'Watchlist CRM' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const current = NAV.find(n => n.href === path);

  return (
    <html lang="es" className="dark">
      <head>
        <title>Movitty Advisor Platform</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased min-h-screen">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar Navigation (Desktop) */}
          <aside className="w-64 shrink-0 glass h-full hidden md:flex flex-col z-20 bg-surface-dark/70 border-r border-white/5">
            <div className="p-6 flex items-center gap-3">
              <div className="bg-primary rounded-lg p-1.5 shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-white text-2xl">auto_graph</span>
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white leading-none">Movitty</h1>
                <p className="text-[10px] uppercase tracking-widest text-primary font-bold mt-1">Advisor Pro</p>
              </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
              {NAV.map(n => {
                const active = path === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-inner'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <span className={`material-symbols-outlined ${active && 'fill-1'}`}>{n.icon}</span>
                    <span className="font-medium text-sm">{n.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2 pb-6">
              <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-sm">add</span>
                <span className="text-sm">New Deal</span>
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="@container flex-1 flex flex-col overflow-y-auto bg-background-light dark:bg-background-dark min-w-0 relative pb-20 md:pb-0">
            {/* Top Bar (Responsive) */}
            <header className="h-16 md:h-20 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-primary/10 md:border-white/5 sticky top-0 bg-background-dark/90 backdrop-blur-md z-10">
              {/* Mobile Identity */}
              <div className="flex md:hidden items-center gap-3">
                <div className="size-8 rounded-full border-2 border-primary/50 p-0.5">
                  <div className="size-full rounded-full bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAo6-sECgk2N3wwHE4Oyx_HHlCC62o2x2FL3dIQTe_F3RWTTeB7kDicCvBPgn_mtXFbILdcnuqOu5iiYiUnQ62rFuPIjeg5alZABx0DfUjfNhGbA2pDH4kvqiG_L10fBOVO4tdiPdUybONXFOb8J4NBYoEcS72pwXshlLOg1pZY_yaXyV9PohRxJRhGC8zyzIscJLfCxwpyHArk4BbUp4SFgucsZjzymOoBU8eSkoNymfunsJDTAsGH5Zy0Kp9D5wi9x3LpPq2Vibpg')" }}></div>
                </div>
              </div>

              {/* Desktop Search / Title */}
              <div className="hidden md:flex flex-1 max-w-xl items-center gap-4">
                <h2 className="text-lg font-bold text-white">{current?.label}</h2>
                <div className="h-4 w-[1px] bg-white/10"></div>
                <span className="text-xs text-primary font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block"></span> API Live
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 md:gap-6 pl-4 md:pl-8">
                <button className="relative p-2 text-slate-400 hover:text-white transition-colors glass-card md:bg-transparent rounded-xl">
                  <span className="material-symbols-outlined text-[20px] md:text-[24px]">notifications</span>
                  <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full neon-glow"></span>
                </button>

                <div className="hidden md:flex items-center gap-3 cursor-pointer group ml-2 border-l border-white/10 pl-6">
                  <div className="text-right">
                    <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Alex Rivera</p>
                    <p className="text-[10px] text-slate-500 font-medium tracking-wide">Premium Advisor</p>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-primary/30 p-0.5">
                    <img alt="Profile" className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAo6-sECgk2N3wwHE4Oyx_HHlCC62o2x2FL3dIQTe_F3RWTTeB7kDicCvBPgn_mtXFbILdcnuqOu5iiYiUnQ62rFuPIjeg5alZABx0DfUjfNhGbA2pDH4kvqiG_L10fBOVO4tdiPdUybONXFOb8J4NBYoEcS72pwXshlLOg1pZY_yaXyV9PohRxJRhGC8zyzIscJLfCxwpyHArk4BbUp4SFgucsZjzymOoBU8eSkoNymfunsJDTAsGH5Zy0Kp9D5wi9x3LpPq2Vibpg" />
                  </div>
                </div>
              </div>
            </header>

            {/* Content Injection */}
            {children}
          </main>

          {/* Bottom Navigation Bar (Mobile) */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-card bg-background-dark/95 border-t border-primary/20 pb-6 pt-3 px-6">
            <div className="flex items-center justify-between max-w-md mx-auto">
              {NAV.map((n, i) => {
                const active = path === n.href;
                // The center button logic
                if (i === 1) {
                  return (
                    <Link key={n.href} href={n.href} className="relative -top-8 size-14 rounded-full bg-primary flex flex-col items-center justify-center text-white neon-glow shadow-xl shadow-primary/40 border-4 border-background-dark transition-transform hover:scale-105">
                      <span className="material-symbols-outlined fill-1 text-[26px]">{n.icon}</span>
                    </Link>
                  );
                }
                return (
                  <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-primary' : 'text-slate-500'}`}>
                    <span className={`material-symbols-outlined ${active ? 'fill-1' : ''}`}>{n.icon}</span>
                    <span className="text-[10px] font-bold">{n.label.split(' ')[0]}</span>
                  </Link>
                );
              })}

              <Link href="#" className="flex flex-col items-center gap-1 text-slate-500">
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-medium">Profile</span>
              </Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
