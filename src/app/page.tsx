'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSearches, clearSearches, type HistoryItem } from '@/lib/history';
import { formatPrice } from '@/lib/marketcheck';

const TOOLS = [
  {
    href: '/smart-search',
    icon: '💬',
    title: 'Smart Search',
    desc: 'Búsqueda natural y Radar de Inventario avanzado en una sola vista.',
    example: '"corolla blanco 2025 en boca raton"',
    color: '#7C6EFA',
  },
  {
    href: '/vin',
    icon: '🧠',
    title: 'VIN Intelligence',
    desc: 'Historial de precios, specs, cálculo FMV y reporte completo de negociación guiada.',
    example: 'KL77LGEP4TC079564',
    color: '#22D3A5',
  }
];

export default function DashboardPage() {
  const [recentSearches, setRecentSearches] = useState<HistoryItem[]>([]);
  const [topDeals, setTopDeals] = useState<Array<{ segment: string; listing: import('@/lib/marketcheck').Listing; fmvAvg: number; savings: number }>>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 60000);
    setTimeout(() => setRecentSearches(getSearches()), 0);

    fetch('/api/top-deals')
      .then(res => res.json())
      .then(data => {
        if (data.deals) setTopDeals(data.deals);
      })
      .catch(() => { })
      .finally(() => setLoadingDeals(false));

    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 md:space-y-8">
      {/* Hero Section */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Bienvenido, Advisor</h2>
          <p className="text-slate-400 mt-2 text-base md:text-lg">Inteligencia de mercado en tiempo real para tu inventario premium.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-dark border border-white/5 rounded-lg text-xs font-bold text-slate-400">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            Hoy
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 @xl:grid-cols-3 gap-4 md:gap-6">
        <div className="card-gradient border border-white/5 p-5 md:p-6 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-[80px] md:text-[100px]">directions_car</span>
          </div>
          <p className="text-slate-400 text-xs md:text-sm font-semibold uppercase tracking-wider">Vehículos Activos</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-2xl md:text-3xl font-black text-white">8M+</h3>
            <span className="text-accent-mint text-[10px] md:text-sm font-bold flex items-center">
              <span className="material-symbols-outlined text-sm">trending_up</span> Diaria
            </span>
          </div>
          <p className="text-slate-500 text-[10px] md:text-xs">Marketcheck API Nacional</p>
        </div>

        <div className="card-gradient border border-white/5 p-5 md:p-6 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-[80px] md:text-[100px]">storefront</span>
          </div>
          <p className="text-slate-400 text-xs md:text-sm font-semibold uppercase tracking-wider">Dealers Cubiertos</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-2xl md:text-3xl font-black text-white">45K+</h3>
            <span className="text-accent-mint text-[10px] md:text-sm font-bold flex items-center">
              <span className="material-symbols-outlined text-sm">trending_up</span> 10+ Años
            </span>
          </div>
          <p className="text-slate-500 text-[10px] md:text-xs">Agencias en red certificadas</p>
        </div>

        {/* Quick Tools Access Card */}
        <div className="card-gradient border border-white/5 p-5 md:p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
          <p className="text-slate-400 text-xs md:text-sm font-semibold uppercase tracking-wider">Acceso Rápido</p>
          <div className="grid grid-cols-2 gap-3 h-full">
            {TOOLS.map(t => (
              <Link key={t.href} href={t.href} className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">{t.icon}</span>
                <span className="text-xs font-bold text-slate-300 group-hover:text-white">{t.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Top 3 Deals */}
      <section>
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">local_fire_department</span>
            Top 3 Imperdibles
          </h2>
          <span className="text-slate-500 text-xs font-semibold bg-white/5 px-2 py-1 rounded">24h Scan</span>
        </div>

        {loadingDeals ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface-dark border border-white/10 rounded-2xl p-5">
                <div className="skeleton h-32 w-full rounded-xl mb-4"></div>
                <div className="skeleton h-6 w-3/4 mb-2"></div>
                <div className="skeleton h-4 w-1/2"></div>
              </div>
            ))}
          </div>
        ) : topDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 @2xl:grid-cols-3 gap-4 md:gap-6">
            {topDeals.map((deal, i) => {
              const lst = deal.listing;
              if (!lst) return null;
              const build = lst.build || {};
              const title = `${build.year || ''} ${build.make || ''} ${build.model || ''}`.trim();
              const photo = lst.media?.photo_links?.[0] || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDaYraoEM4VCVTiccmoolnphlDe_yI5VZqCVAC6PRDhhGSH6jEeXSphof_bnZd5U18JWbYJIKMEps0_NzcGfJO3a6l7Tl8G6JiUqIIAMmDeCGauNA4oEhghp2yT2C3bViBSe3AwZ5YhStDmIoLARI1shRfp5B2HI56aU-IYDYhFYZSL-nZlpsRiWt7JOlrEBNhc8JvJ66WkAcM_dpjn0Uc4JEiRUAvZx668yZJiozixqudKLNnKQX3z1BH7ZFexVGgsDt4igAdTCLXQ'; // Fallback to BMW Stitch image

              return (
                <div key={i} className="bg-surface-dark border border-white/10 rounded-2xl overflow-hidden hover:border-primary/50 transition-all shadow-lg shadow-black/20 group flex flex-col">
                  <div className="h-44 relative overflow-hidden bg-white/5">
                    <img src={photo} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent opacity-80"></div>
                    <div className="absolute top-3 left-3 bg-accent-mint text-background-dark text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg">💰 Ahorro {formatPrice(deal.savings)}</div>
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-primary text-[10px] font-bold px-2 py-1 rounded-lg border border-primary/20">
                      {deal.segment}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between -mt-6 relative z-10">
                    <div className="mb-4">
                      <h4 className="text-white font-bold text-lg leading-tight mb-1">{title}</h4>
                      <p className="text-slate-400 text-xs">{lst.miles ? `${lst.miles.toLocaleString()} mi` : 'Millas N/D'} • {lst.exterior_color || 'Color N/D'}</p>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-slate-500 text-xs line-through">{formatPrice(deal.fmvAvg)} Avg</p>
                        <p className="text-2xl font-black text-white">{formatPrice(lst.price)}</p>
                      </div>
                      <Link href={`/vin?v=${lst.vin || ''}`}>
                        <button className="bg-primary/20 hover:bg-primary text-primary hover:text-white p-2 rounded-lg transition-all border border-primary/30 shadow-lg shadow-primary/10">
                          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface-dark/50 border border-white/5 rounded-2xl p-8 text-center text-slate-500 font-medium">
            No se encontraron oportunidades excepcionales hoy en el mercado rápido.
          </div>
        )}
      </section>

      {/* Recent Searches Row */}
      {recentSearches.length > 0 && (
        <section className="bg-surface-dark/50 border border-white/5 rounded-2xl p-5 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

          <div className="flex items-center justify-between mb-5 relative z-10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Actividad Reciente
            </h2>
            <button onClick={() => { clearSearches(); setRecentSearches([]); }} className="text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
              Limpiar Todo
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
            {recentSearches.map((s, i) => (
              <Link key={i} href={s.url}>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/20 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${s.type === 'vin' ? 'bg-accent-mint/10 text-accent-mint' : 'bg-primary/10 text-primary'}`}>
                      <span className="material-symbols-outlined text-[20px]">
                        {s.type === 'vin' ? 'barcode_scanner' : 'search_check'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.type === 'vin' ? `VIN: ${s.query}` : `"${s.query}"`}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{s.type === 'vin' ? 'Lookup' : 'Natural Search'} • Hace {now ? Math.max(0, Math.floor((now - s.timestamp) / 60000)) : 0} min</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-500 text-sm group-hover:text-primary transition-colors shrink-0 mr-2 group-hover:translate-x-1">arrow_forward</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
