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

  useEffect(() => {
    setRecentSearches(getSearches());

    fetch('/api/top-deals')
      .then(res => res.json())
      .then(data => {
        if (data.deals) setTopDeals(data.deals);
      })
      .catch(() => { })
      .finally(() => setLoadingDeals(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
          Bienvenido, Advisor 👋
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480 }}>
          Tu plataforma de inteligencia vehicular. Datos en tiempo real de Marketcheck para negociar mejor.
        </p>
      </div>

      {/* Tool cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {TOOLS.map(t => (
          <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              padding: '22px 22px 18px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              height: '100%',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${t.color}18`,
                  border: `1px solid ${t.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {t.icon}
                </div>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{t.title}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                {t.desc}
              </p>

            </div>
          </Link>
        ))}
      </div>

      {/* Top 3 Deals (Daily cached) */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text-secondary)' }}>
          🔥 TOP 3 IMPERDIBLES
        </div>

        {loadingDeals ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }}></div>
                <div className="skeleton" style={{ height: 16, width: '40%' }}></div>
              </div>
            ))}
          </div>
        ) : topDeals.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {topDeals.map((deal, i) => {
              const lst = deal.listing;
              if (!lst) return null;
              const build = lst.build || {};
              const title = `${build.year || ''} ${build.make || ''} ${build.model || ''}`.trim();

              return (
                <div key={i} className="card" style={{ padding: 16, border: '1px solid var(--border-color)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -10, right: 16 }}>
                    <span className="badge badge-accent" style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px' }}>
                      {deal.segment}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatPrice(lst.price)}
                    </span>
                    <span style={{ fontSize: 13, textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                      {formatPrice(deal.fmvAvg)}
                    </span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <span className="badge badge-green" style={{ fontSize: 12 }}>
                      💰 Ahorro {formatPrice(deal.savings)} vs Mercado
                    </span>
                  </div>

                  <Link href={`/vin?v=${lst.vin || ''}`} style={{ textDecoration: 'none' }}>
                    <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                      Analizar VIN →
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
            No se encontraron oportunidades excepcionales hoy.
          </div>
        )}
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              BÚSQUEDAS RECIENTES
            </div>
            <button
              onClick={() => { clearSearches(); setRecentSearches([]); }}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, padding: '4px 8px', color: 'var(--text-muted)' }}
            >
              🗑️ Limpiar Historial
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {recentSearches.map((s, i) => (
              <Link key={i} href={s.url} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    background: s.type === 'vin' ? 'rgba(34,211,165,0.1)' : 'rgba(124,110,250,0.1)'
                  }}>
                    {s.type === 'vin' ? '🧠' : s.type === 'filters' ? '📡' : '💬'}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {s.query}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Hace {Math.max(0, Math.floor((Date.now() - s.timestamp) / 60000))} min
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="card" style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text-secondary)' }}>
          MARKETCHECK API — DATOS EN TIEMPO REAL
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {[
            { label: 'Vehículos Activos', value: '8M+', icon: '🚗' },
            { label: 'Dealers Cubiertos', value: '45K+', icon: '🏪' },
            { label: 'Años de Historial', value: '10+', icon: '📅' },
            { label: 'Actualizaciones', value: 'Diaria', icon: '🔄' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
