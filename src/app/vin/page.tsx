'use client';
import { useState, useEffect } from 'react';
import { saveSearch } from '@/lib/history';
import { type Build, type Listing, type FMV, buildPriceTimeline, calcFMV, formatPrice, daysSinceUnix, getDealerInfo } from '@/lib/marketcheck';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { AnimatedSkeleton } from '@/components/ui/AnimatedSkeleton';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { AiVoiceSummary } from '@/components/ui/AiVoiceSummary';

const DOM_PRESSURE = 30;
const PRICE_DROP = 800;

interface ReportData {
    specs: Build;
    history: Listing[];
    market: { listings: Listing[]; num_found: number };
    fmv: FMV | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeListing?: any;
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
        const v = params.get('vin') || params.get('v');
        if (v && v.length === 17) {
            setTimeout(() => setVin(v), 0);
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
        const activeListing = histData.activeListing || null;

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
        setReport({ specs: specData, history, market: marketData, fmv, activeListing });

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
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="section-header mb-8 md:mb-12 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="section-title">🔍 VIN Intelligence</h1>
                    <p className="section-desc">Historial completo, especificaciones y reporte de negociación</p>
                </div>
                {report && !loading && (
                    <PdfExportButton targetId="vin-report-content" filename={`movitty-report-${vin}.pdf`} />
                )}
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
                    <div className="alert alert-neutral mb-16 backdrop-blur">
                        <span className="alert-icon">⏳</span> Inicializando Asset Auditor y triangulando mercado histórico...
                    </div>
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <StaggerItem key={i}>
                                <GlassCard className="p-6">
                                    <AnimatedSkeleton className="h-4 w-1/3 mb-6 bg-primary/20" />
                                    <AnimatedSkeleton className="h-8 w-3/4 mb-4" />
                                    <AnimatedSkeleton className="h-4 w-1/2" />
                                </GlassCard>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </div>
            )}

            {/* Report Content */}
            {report && !loading && (
                <motion.div id="vin-report-content" className="bg-base pb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
                    {/* Hero Spec Block */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                        <div className="lg:col-span-8 flex flex-col gap-4 bg-surface-dark rounded-xl p-6 border border-white/10 shadow-sm relative overflow-hidden"
                            style={{ backgroundImage: 'radial-gradient(rgba(126, 112, 250, 0.1) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                            <div className="flex flex-col md:flex-row justify-between items-start z-10 gap-6">
                                <div className="flex-1 min-w-0">
                                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider mb-2 border border-green-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Verified Asset
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-100 tracking-tighter truncate">
                                        {report.specs.year ?? ''} {report.specs.make ?? ''} {report.specs.model ?? ''} {report.specs.trim ?? ''}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-4 mt-3 mb-2">
                                        <p className="text-slate-400 font-mono text-sm leading-none border-r border-white/10 pr-4">VIN: {vin}</p>

                                        <a href="https://movitty.com" target="_blank" rel="noreferrer" className="group flex items-center gap-3 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-primary/30 rounded-xl p-1.5 pr-4 transition-all w-fit">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center p-0 bg-white/5 relative overflow-hidden shrink-0">
                                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <img src="/movitty-logo-m.png" alt="Movitty" className="w-full h-full object-cover relative z-10 transition-transform group-hover:scale-105" />
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold leading-none mb-0.5 group-hover:text-slate-300">Negocia en</span>
                                                <span className="text-sm font-bold leading-none text-white group-hover:text-primary transition-colors flex items-center gap-1">
                                                    Movitty <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                                </span>
                                            </div>
                                        </a>
                                    </div>

                                    <div className="mt-6 border-t border-white/5 pt-6 w-full">
                                        <div className="flex flex-col shrink-0">
                                            <span className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-1">DOM Pressure</span>
                                            <div className="flex items-end gap-2">
                                                <div className={`text-4xl font-black italic ${dom > 45 ? 'text-red-400' : dom > 30 ? 'text-yellow-400' : 'text-primary'} leading-none`}>
                                                    {dom}
                                                </div>
                                                <span className={`text-lg font-bold italic mb-0.5 ${dom > 45 ? 'text-red-400/80' : dom > 30 ? 'text-yellow-400/80' : 'text-primary/80'}`}>DAYS</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {report.activeListing?.media?.photo_links?.[0] && (
                                    <div className="w-full md:w-[280px] xl:w-[320px] aspect-video rounded-lg overflow-hidden border border-white/10 shadow-lg shrink-0">
                                        <img
                                            src={report.activeListing.media.photo_links[0]}
                                            alt="Vehicle"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 z-10">
                                <div className="bg-background-dark/50 p-4 rounded-lg border border-primary/5">
                                    <span className="material-symbols-outlined text-primary mb-2">engineering</span>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">Engine</p>
                                    <p className="text-slate-100 font-bold text-sm truncate">{report.specs.engine || 'N/A'}</p>
                                </div>
                                <div className="bg-background-dark/50 p-4 rounded-lg border border-primary/5">
                                    <span className="material-symbols-outlined text-primary mb-2">settings_input_component</span>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">Trans</p>
                                    <p className="text-slate-100 font-bold text-sm truncate">{report.specs.transmission || 'N/A'}</p>
                                </div>
                                <div className="bg-background-dark/50 p-4 rounded-lg border border-primary/5">
                                    <span className="material-symbols-outlined text-primary mb-2">settings_motion_mode</span>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">Drivetrain</p>
                                    <p className="text-slate-100 font-bold text-sm truncate">{report.specs.drivetrain || 'N/A'}</p>
                                </div>
                                <div className="bg-background-dark/50 p-4 rounded-lg border border-primary/5">
                                    <span className="material-symbols-outlined text-primary mb-2">palette</span>
                                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">Color</p>
                                    <p className="text-slate-100 font-bold text-sm truncate capitalize">{report.activeListing?.exterior_color || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Market Location Index */}
                        <div className="lg:col-span-4 bg-surface-dark rounded-xl p-6 border border-white/10 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Market Location Index</h3>
                                    <span className="text-primary material-symbols-outlined">location_on</span>
                                </div>
                                <div className="h-32 rounded-lg bg-background-dark overflow-hidden relative border border-primary/20">
                                    <div className="absolute inset-0 bg-cover bg-center opacity-40 grayscale" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA1j9RqEJpLDf19dtpU1_Xg2t3QONvhbdgoa0HtKqh50wTDxQ2Zl7W3gT4p1UWUoj7sKfYHO6SxCsIbXxIuR3XKN_pnZD-6Ia85d6CXNw_D3PxAvcuXL3TUGWzxVtWlNo4JF3xIjspByUJmV2kp0L41IN37OEZbkEhzy8AoVhWE0jYCMiXjZmll173KjQaFGhX02kLGL1zPbNO7C_RxIPFq8gTfRFZKBNWzKQFvf7eR0gY2WP-42MxdzMML7VJZ7rNRwhe-ckgWplU1')" }}></div>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                        <span className="text-2xl font-black text-white drop-shadow-md text-center">{dealer.city ? `${dealer.city}, ${dealer.state}` : 'NATIONAL'}</span>
                                        <span className="text-[10px] font-mono text-primary-light">{dealer.name || 'Market Default Radius'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                    <span>DEMAND LEVEL</span>
                                    <span className={report.fmv && report.fmv.sample > 20 ? "text-green-400" : "text-yellow-400"}>
                                        {report.fmv && report.fmv.sample > 20 ? 'HIGH' : 'MODERATE'}
                                    </span>
                                </div>
                                <div className="w-full bg-background-dark rounded-full h-2">
                                    <div className={`bg-gradient-to-r ${report.fmv && report.fmv.sample > 20 ? 'from-primary to-green-400' : 'from-yellow-600 to-yellow-400'} h-2 rounded-full`} style={{ width: report.fmv ? Math.min((report.fmv.sample / 50) * 100, 100) + '%' : '50%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FMV Grid (Replacing Stats Header) */}
                    {report.fmv && (
                        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <StaggerItem>
                                <GlassCard className="p-5 border-l-4 border-l-slate-600 h-full">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Low Auction</p>
                                    <h4 className="text-2xl font-black mt-2 text-slate-300 font-mono">{formatPrice(report.fmv.low)}</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase">Wholesale threshold</p>
                                </GlassCard>
                            </StaggerItem>
                            <StaggerItem>
                                <GlassCard className="p-5 border-l-4 border-l-blue-400 h-full">
                                    <p className="text-xs font-bold text-blue-400/70 uppercase tracking-widest font-mono">Fair Average</p>
                                    <h4 className="text-2xl font-black mt-2 text-white font-mono">{formatPrice(report.fmv.avg)}</h4>
                                    <p className="text-[10px] text-blue-400/80 mt-1 uppercase">Market Standard Price</p>
                                </GlassCard>
                            </StaggerItem>
                            <StaggerItem>
                                <GlassCard className="p-5 border-l-4 border-l-primary ring-1 ring-primary/20 bg-primary/5 h-full relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl -mr-16 -mt-16 rounded-full"></div>
                                    <p className="text-xs font-bold text-primary uppercase tracking-widest font-mono relative z-10">Target Acquisition</p>
                                    <h4 className="text-2xl font-black mt-2 text-white font-mono relative z-10">{formatPrice(currP > 0 ? currP : report.fmv.median)}</h4>
                                    <p className="text-[10px] text-primary/80 mt-1 uppercase relative z-10">Current Listed Price</p>
                                </GlassCard>
                            </StaggerItem>
                            <StaggerItem>
                                <GlassCard className="p-5 border-l-4 border-l-accent-success h-full">
                                    <p className="text-xs font-bold text-accent-success uppercase tracking-widest font-mono">Retail High</p>
                                    <h4 className="text-2xl font-black mt-2 text-white font-mono">{formatPrice(report.fmv.high)}</h4>
                                    <p className="text-[10px] text-accent-success/80 mt-1 uppercase font-bold">
                                        {currP > 0 && report.fmv.high > currP ? `Potential Margin: +${formatPrice(report.fmv.high - currP)}` : `Premium Retail`}
                                    </p>
                                </GlassCard>
                            </StaggerItem>
                        </StaggerContainer>
                    )}

                    {/* 1. Specs */}
                    <Section icon="📋" title="Ficha Técnica Confirmada" defaultOpen>
                        <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                                <StaggerItem key={k}>
                                    <GlassCard className="p-4 flex flex-col justify-center h-full hoverEffect={false}">
                                        <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-mono">{k}</div>
                                        <div className="text-sm font-semibold text-slate-200">{v}</div>
                                    </GlassCard>
                                </StaggerItem>
                            ))}
                        </StaggerContainer>
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
                            <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {[
                                    ['Mínimo', formatPrice(report.fmv.low), 'text-green-400'],
                                    ['Promedio', formatPrice(report.fmv.avg), 'text-slate-200'],
                                    ['Mediana', formatPrice(report.fmv.median), 'text-slate-200'],
                                    ['Máximo', formatPrice(report.fmv.high), 'text-red-400'],
                                ].map(([k, v, c]) => (
                                    <StaggerItem key={k}>
                                        <GlassCard className="p-4" hoverEffect={false}>
                                            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-widest font-mono">{k}</div>
                                            <div className={`text-lg font-black font-mono ${c as string}`}>{v}</div>
                                        </GlassCard>
                                    </StaggerItem>
                                ))}
                            </StaggerContainer>
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
                                                formatter={(v: number | string | undefined) => [`$${Number(v ?? 0).toLocaleString()}`, 'Precio']}
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
                </motion.div>
            )}
        </div>
    );
}

