'use client';
import { useState, useEffect } from 'react';
import { saveSearch } from '@/lib/history';
import { type Build, type Listing, type FMV, buildPriceTimeline, calcFMV, formatPrice, safeInt, daysSinceUnix, getDealerInfo } from '@/lib/marketcheck';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const DOM_PRESSURE = 30;
const PRICE_DROP = 800;

interface ReportData {
    specs: Build;
    history: Listing[];
    market: { listings: Listing[]; num_found: number };
    fmv: FMV | null;
}

function Section({ icon, title, children, defaultOpen = false }: { icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="report-section mb-16">
            <div className="report-section-header" onClick={() => setOpen(o => !o)}>
                <div className="report-section-title"><span>{icon}</span>{title}</div>
                <span className={`report-chevron ${open ? 'open' : ''}`}>▼</span>
            </div>
            {open && <div className="report-section-body">{children}</div>}
        </div>
    );
}

export default function VinIntelligencePage() {
    const [vin, setVin] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<ReportData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const v = params.get('v');
        if (v && v.length === 17) {
            setVin(v);
            setTimeout(() => {
                const btn = document.getElementById('btn-vin-search');
                if (btn && !btn.hasAttribute('disabled')) btn.click();
            }, 100);
        }
    }, []);

    async function generate() {
        const v = vin.trim().toUpperCase();
        if (v.length !== 17) { setError('El VIN debe tener exactamente 17 caracteres.'); return; }
        setLoading(true); setError(''); setReport(null);

        const [specRes, histRes] = await Promise.all([
            fetch(`/api/specs?vin=${v}`),
            fetch(`/api/vin-history?vin=${v}`),
        ]);

        const specData = specRes.ok ? await specRes.json() : await specRes.json().catch(() => ({}));
        const histData = histRes.ok ? await histRes.json() : await histRes.json().catch(() => ({ listings: [] }));

        if (specData.error) {
            setError(specData.error);
            setLoading(false);
            return;
        }

        const history: Listing[] = histData.listings ?? [];
        if (!history.length && !Object.keys(specData).length) {
            setError('VIN no encontrado en Marketcheck.');
            setLoading(false);
            return;
        }

        const make = specData.make ?? '';
        const model = specData.model ?? '';
        const year = specData.year ?? '';

        let marketData = { listings: [] as Listing[], num_found: 0 };
        if (make && model) {
            const params = new URLSearchParams({ make, model, rows: '50' });
            if (year) params.set('year', String(year));
            const mr = await fetch(`/api/search?${params}`);
            if (mr.ok) marketData = await mr.json();
        }

        const fmv = calcFMV(marketData.listings, marketData.num_found);
        setReport({ specs: specData, history, market: marketData, fmv });

        saveSearch({
            type: 'vin',
            query: `${year} ${make} ${model} (${v})`.trim(),
            url: `/vin?v=${v}`
        });

        setLoading(false);
    }

    // Derived values
    const timeline = report ? buildPriceTimeline(report.history) : [];
    const firstH = report?.history.length ? report.history.reduce((a, b) => (a.first_seen_at ?? 0) < (b.first_seen_at ?? 0) ? a : b) : null;
    const lastH = report?.history.length ? report.history.reduce((a, b) => (a.first_seen_at ?? 0) > (b.first_seen_at ?? 0) ? a : b) : null;
    const dom = firstH ? daysSinceUnix(firstH.first_seen_at) : 0;
    const currP = timeline[timeline.length - 1]?.price ?? 0;
    const initP = timeline[0]?.price ?? 0;
    const totalDrop = currP - initP;
    const biggestDrop = timeline.length ? Math.min(...timeline.filter(e => e.delta < 0).map(e => e.delta), 0) : 0;
    const dealer = lastH ? getDealerInfo(lastH) : {};

    const chartData = timeline.map(p => ({ date: p.date, price: p.price }));

    // Strengths & weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (report) {
        if (dom > DOM_PRESSURE) weaknesses.push(`El auto lleva ${dom} días en inventario desde ${firstH?.first_seen_at_date?.slice(0, 10) ?? ''}. El dealer tiene presión de rotación.`);
        if (totalDrop < -PRICE_DROP) weaknesses.push(`El precio bajó ${formatPrice(Math.abs(totalDrop))} desde su publicación (${formatPrice(initP)} → ${formatPrice(currP)}). El vendedor ya se movió.`);
        if (biggestDrop < -PRICE_DROP) weaknesses.push(`La rebaja más agresiva fue de ${formatPrice(Math.abs(biggestDrop))}. Señal de urgencia.`);

        const fmv = report.fmv;
        if (fmv) {
            const gap = currP - fmv.avg;
            if (gap > 500) strengths.push(`El auto está ${formatPrice(gap)} por encima del promedio del mercado (${formatPrice(currP)} vs ${formatPrice(fmv.avg)}). Argumento directo de negociación.`);
            if (gap < -500) strengths.push(`Precio ${formatPrice(Math.abs(gap))} por debajo del promedio del mercado. Oportunidad real — actuar rápido.`);
            if (fmv.low < currP) strengths.push(`Hay ${fmv.total.toLocaleString()} unidades similares activas. El precio más bajo del mercado es ${formatPrice(fmv.low)}.`);
        }
        if (dom > 60) strengths.push(`A más de 60 días en inventario, el dealer enfrenta costos de piso. Una oferta directa tiene alta probabilidad de éxito.`);
    }

    const score = weaknesses.length * 2 + strengths.length;
    const verdict = score >= 4
        ? { label: 'MÁXIMA PRESIÓN', desc: 'Todas las condiciones favorecen al comprador. Oferta agresiva justificada.', emoji: '🔥', cls: 'verdict-max' }
        : score >= 2
            ? { label: 'BUENA OPORTUNIDAD', desc: 'Hay argumentos sólidos. Negociar con confianza y datos.', emoji: '💡', cls: 'verdict-good' }
            : { label: 'MERCADO EQUILIBRADO', desc: 'Poca presión sobre el vendedor. Negociar con información.', emoji: '⚖️', cls: 'verdict-balanced' };

    return (
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div className="section-header mb-20">
                <div>
                    <h1 className="section-title">🔍 VIN Intelligence</h1>
                    <p className="section-desc">Historial completo, especificaciones y reporte de negociación</p>
                </div>
            </div>

            {/* VIN Input */}
            <div className="card mb-20">
                <div className="card-body">
                    <div className="form-group mb-12">
                        <label className="form-label">Número de Serie (VIN — 17 caracteres)</label>
                        <input
                            className="form-input vin-input"
                            placeholder="Ej: KL77LGEP4TC079564"
                            value={vin}
                            maxLength={17}
                            onChange={e => setVin(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && generate()}
                        />
                        <div style={{ fontSize: 11, color: vin.length === 17 ? 'var(--green)' : 'var(--text-muted)', marginTop: 4 }}>
                            {vin.length}/17 caracteres {vin.length === 17 && '✓'}
                        </div>
                    </div>
                    <button id="btn-vin-search" className="btn btn-primary" onClick={generate} disabled={loading || vin.length !== 17}>
                        {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Analizando...</> : '🧠 Generar Intelligence Report'}
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-16"><span className="alert-icon">⚠️</span>{error}</div>}

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="alert alert-neutral mb-16">
                        <span className="alert-icon">⏳</span> Consultando specs, historial de precios y mercado activo...
                    </div>
                    {[...Array(3)].map((_, i) => <div key={i} className="card" style={{ padding: 24 }}>
                        <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 16 }} />
                        <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
                    </div>)}
                </div>
            )}

            {/* Report Content */}
            {report && !loading && (
                <>
                    {/* Verdict */}
                    <div className={`verdict-card mb-20 ${verdict.cls}`}>
                        <span className="verdict-icon">{verdict.emoji}</span>
                        <div>
                            <div className="verdict-title">{verdict.label}</div>
                            <div className="verdict-desc">{verdict.desc}</div>
                        </div>
                    </div>

                    {/* Stats Header */}
                    <div className="stat-grid mb-20">
                        <div className="stat-tile">
                            <span className="stat-label">Precio Actual</span>
                            <span className="stat-value" style={{ color: 'var(--accent)' }}>{formatPrice(currP)}</span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Variación Total</span>
                            <span className="stat-value" style={{ color: totalDrop < 0 ? 'var(--green)' : totalDrop > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                                {totalDrop === 0 ? '—' : `${totalDrop > 0 ? '+' : ''}${formatPrice(totalDrop)}`}
                            </span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Días en Mercado</span>
                            <span className="stat-value" style={{ color: dom > 45 ? 'var(--red)' : dom > 30 ? 'var(--yellow)' : 'var(--text-primary)' }}>{dom}</span>
                            <span className="stat-sub">{dom > 45 ? '🔥 Presión ↑' : dom > 30 ? '⚠️ Monitorear' : '✓ Reciente'}</span>
                        </div>
                    </div>

                    {/* 1. Specs */}
                    <Section icon="📋" title="Ficha Técnica Confirmada" defaultOpen>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                            {[
                                ['Vehículo', `${report.specs.year ?? ''} ${report.specs.make ?? ''} ${report.specs.model ?? ''} ${report.specs.trim ?? ''}`.trim()],
                                ['Carrocería', `${report.specs.body_type ?? 'N/D'} · ${report.specs.doors ?? '?'} puertas`],
                                ['Motor', `${report.specs.engine ?? 'N/D'} · ${report.specs.cylinders ?? '?'} cil.`],
                                ['Transmisión', report.specs.transmission ?? 'N/D'],
                                ['Tracción', report.specs.drivetrain ?? 'N/D'],
                                ['Combustible', report.specs.fuel_type ?? 'N/D'],
                                ['Economía', report.specs.city_mpg ? `${report.specs.city_mpg} / ${report.specs.highway_mpg} MPG` : 'N/D'],
                                ['Pasajeros', report.specs.std_seating ?? 'N/D'],
                                ['Fabricado en', report.specs.made_in ?? 'N/D'],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* 2. Fortalezas & Debilidades */}
                    {(strengths.length > 0 || weaknesses.length > 0) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                            {strengths.length > 0 && (
                                <Section icon="💪" title={`Fortalezas de Negociación (${strengths.length})`} defaultOpen>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {strengths.map((s, i) => (
                                            <div key={i} className="alert alert-success"><span className="alert-icon">✅</span><span>{s}</span></div>
                                        ))}
                                    </div>
                                </Section>
                            )}
                            {weaknesses.length > 0 && (
                                <Section icon="🎯" title={`Debilidades del Vendedor (${weaknesses.length})`} defaultOpen>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {weaknesses.map((w, i) => (
                                            <div key={i} className="alert alert-danger"><span className="alert-icon">🔴</span><span>{w}</span></div>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </div>
                    )}

                    {/* 3. FMV */}
                    {report.fmv && (
                        <Section icon="⚖️" title="Fair Market Value (Mercado Actual)" defaultOpen>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
                                {[
                                    ['Mínimo', formatPrice(report.fmv.low), 'var(--green)'],
                                    ['Promedio', formatPrice(report.fmv.avg), 'var(--text-primary)'],
                                    ['Mediana', formatPrice(report.fmv.median), 'var(--text-primary)'],
                                    ['Máximo', formatPrice(report.fmv.high), 'var(--red)'],
                                ].map(([k, v, c]) => (
                                    <div key={k} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px 14px' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k}</div>
                                        <div style={{ fontWeight: 700, color: c as string }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Basado en {report.fmv.sample} listings activos de {report.fmv.total.toLocaleString()} totales.
                                {currP > 0 && (() => {
                                    const gap = currP - report.fmv!.avg;
                                    return <span style={{ color: gap > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                                        {' '}Precio objetivo del VIN: {gap > 0 ? '+' : ''}{formatPrice(gap)} vs. promedio de mercado.
                                    </span>;
                                })()}
                            </p>
                        </Section>
                    )}

                    {/* 4. Timeline y Gráfica */}
                    {timeline.length > 0 && (
                        <Section icon="📈" title="Evolución de Precio Histórica" defaultOpen>
                            {chartData.length > 1 && (
                                <div style={{ height: 180, marginBottom: 20 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#7C6EFA" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#7C6EFA" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="date" tick={{ fill: '#55556A', fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#55556A', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip
                                                contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13 }}
                                                labelStyle={{ color: '#8888AA' }}
                                                formatter={(v: any) => [`$${v.toLocaleString()}`, 'Precio']}
                                            />
                                            <Area type="monotone" dataKey="price" stroke="#7C6EFA" strokeWidth={2} fill="url(#priceGrad)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            <div className="timeline">
                                {timeline.map((e, i) => {
                                    const dir = e.delta < 0 ? 'down' : e.delta > 0 ? 'up' : 'same';
                                    return (
                                        <div key={i} className="timeline-entry">
                                            <div className={`timeline-dot ${dir}`} />
                                            <span className="timeline-date">{e.date}</span>
                                            <span className="timeline-price">{formatPrice(e.price)}</span>
                                            {e.delta !== 0 && (
                                                <span className={`timeline-delta ${dir}`}>
                                                    {dir === 'down' ? '↓' : '↑'} {formatPrice(Math.abs(e.delta))}
                                                </span>
                                            )}
                                            {i === 0 && <span className="badge badge-muted" style={{ marginLeft: 'auto', fontSize: 10 }}>Inicial</span>}
                                            {i === timeline.length - 1 && i !== 0 && <span className="badge badge-accent" style={{ marginLeft: 'auto', fontSize: 10 }}>Actual</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Dealer Info Section at the bottom */}
                            {(dealer.name || lastH?.vdp_url) && (
                                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                                    {dealer.name && (
                                        <div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DEALER</div>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{dealer.name}</div>
                                            {dealer.city && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{dealer.city}, {dealer.state}</div>}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        {lastH?.vdp_url && (
                                            <a href={lastH.vdp_url} target="_blank" rel="noopener" className="btn btn-primary btn-sm">
                                                🔗 Ver en el Dealer →
                                            </a>
                                        )}
                                        <button className="btn btn-ghost btn-sm" onClick={() => {
                                            const text = [
                                                `🧠 MOVITTY INTELLIGENCE REPORT · VIN: ${vin}`,
                                                `Vehículo: ${report.specs.year} ${report.specs.make} ${report.specs.model}`,
                                                `Precio actual: ${formatPrice(currP)} · DOM: ${dom} días`,
                                                `FMV (promedio de mercado): ${formatPrice(report.fmv?.avg)}`,
                                                ...(weaknesses.length ? [`\nDebilidades detectadas: ${weaknesses.join(' | ')}`] : []),
                                                ...(strengths.length ? [`Fortalezas para negociar: ${strengths.join(' | ')}`] : []),
                                                `\nVeredicto: ${verdict.label}`,
                                            ].join('\n');
                                            navigator.clipboard.writeText(text);
                                        }}>
                                            📋 Copiar Resumen
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}
                </>
            )}
        </div>
    );
}

