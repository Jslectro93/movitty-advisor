'use client';
import { useState, useRef, useEffect } from 'react';
import { saveSearch } from '@/lib/history';
import { parseQuery, type ParsedQuery } from '@/lib/parser';
import { type Listing, type FMV, calcFMV, formatPrice, safeInt } from '@/lib/marketcheck';

import { GlassCard } from '@/components/ui/GlassCard';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { AnimatedSkeleton } from '@/components/ui/AnimatedSkeleton';
import { WatchlistButton } from '@/components/ui/WatchlistButton';

const SUGGESTIONS = [
    'corolla blanco 2025 en boca raton',
    'rav4 negro 2023 cerca de miami',
    'civic plateado 2024 en orlando',
    'tacoma gris 2022 en dallas tx',
    'equinox rojo 2023 en houston',
];

const MAKES = ['Toyota', 'Honda', 'Chevrolet', 'Ford', 'Nissan', 'Hyundai', 'Kia', 'Jeep', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Subaru', 'Mazda', 'Dodge', 'Ram', 'GMC', 'Lexus', 'Tesla'];
const YEARS = Array.from({ length: 15 }, (_, i) => String(2025 - i));
const COLORS_EN = ['White', 'Black', 'Gray', 'Silver', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Beige'];

export default function SmartSearchPage() {
    // Chat Mode State
    const [query, setQuery] = useState('');
    const [parsed, setParsed] = useState<ParsedQuery | null>(null);
    const [locationLabel, setLocationLabel] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [sortKey, setSortKey] = useState<'dom' | 'price'>('dom');

    // Shared State
    const [loading, setLoading] = useState(false);
    const [listings, setListings] = useState<Listing[]>([]);
    const [fmv, setFmv] = useState<FMV | null>(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');

    // Load from URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        if (q) {
            setTimeout(() => setQuery(q), 0);
            // Run search automatically
            setTimeout(() => {
                const btn = document.getElementById('btn-search-chat');
                if (btn && !btn.hasAttribute('disabled')) btn.click();
            }, 100);
        }
    }, []);

    async function handleSearchChat() {
        if (!query.trim()) return;
        setLoading(true); setError(''); setListings([]); setFmv(null);

        const p = parseQuery(query);
        setParsed(p);

        const parsedModel = p.model ?? p.model_free;
        const parsedMake = p.make ?? parsedModel;

        if (!parsedModel && !parsedMake) { setError('No pude identificar el vehículo. Ej: "Toyota" o "corolla 2025"'); setLoading(false); return; }

        let currentZip = '';
        let locLabel = 'Nacional';
        if (p.location_raw) {
            try {
                const lr = await fetch(`/api/location?city=${encodeURIComponent(p.location_raw)}`);
                if (lr.ok) {
                    const loc = await lr.json();
                    currentZip = loc.zip ?? '';
                    locLabel = `${loc.city}, ${loc.state}`;
                }
            } catch { }
        }
        setLocationLabel(locLabel);

        const params = new URLSearchParams();
        if (parsedMake) params.set('make', parsedMake);
        if (parsedModel) params.set('model', parsedModel);
        if (p.year) params.set('year', p.year);
        if (p.color) params.set('exterior_color', p.color);
        if (currentZip) { params.set('zip', currentZip); params.set('radius', '100'); }
        params.set('rows', '50');

        await executeSearch(params);
    }

    function appendToQuery(val: string) {
        if (!val) return;
        setQuery(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return val;
            if (trimmed.endsWith(val)) return prev;
            return `${trimmed} ${val}`;
        });
    }

    async function executeSearch(params: URLSearchParams) {
        try {
            const r = await fetch(`/api/search?${params}`);
            const data = await r.json();
            if (data.error || !r.ok) {
                setError(data.error || `Error de API: ${r.status}`);
                setLoading(false);
                return;
            }
            const lst: Listing[] = data.listings ?? [];
            const t = data.num_found ?? lst.length;
            setListings(lst);
            setTotal(t);
            setFmv(calcFMV(lst, t));

            // Save to history
            if (query) {
                saveSearch({ type: 'chat', query, url: `/smart-search?q=${encodeURIComponent(query)}` });
            }
        } catch { setError('Error de conexión. Intenta de nuevo.'); }

        setLoading(false);
    }

    const liveParsePreview = query.trim() ? parseQuery(query) : null;

    const sortedListings = [...listings].sort((a, b) =>
        sortKey === 'dom'
            ? safeInt(b.dom) - safeInt(a.dom)
            : safeInt(a.price) - safeInt(b.price)
    );

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="section-header mb-8 md:mb-12">
                <div>
                    <h1 className="section-title">💬 Smart Search</h1>
                    <p className="section-desc">Encuentra y analiza inventario rápidamente</p>
                </div>
            </div>
            {/* Removed Mode Tabs */}

            {/* Search Controls */}
            <div className="card mb-20">
                <div className="card-body">
                    <div className="form-group mb-12">
                        <textarea
                            ref={inputRef}
                            className="form-textarea"
                            style={{ minHeight: 70, fontSize: 15 }}
                            placeholder='Ej: "corolla blanco 2025 en boca raton o cerca"'
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearchChat(); } }}
                        />
                    </div>

                    {/* Filter Helpers */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                        <select className="form-select w-full" onChange={e => { appendToQuery(e.target.value); e.target.value = ''; }}>
                            <option value="">Marca</option>
                            {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input
                            className="form-input w-full"
                            placeholder="Modelo"
                            onBlur={e => { if (e.target.value.trim()) { appendToQuery(e.target.value.trim()); e.target.value = ''; } }}
                            onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { e.preventDefault(); appendToQuery(e.currentTarget.value.trim()); e.currentTarget.value = ''; } }}
                        />
                        <select className="form-select w-full" onChange={e => { appendToQuery(e.target.value); e.target.value = ''; }}>
                            <option value="">Año</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select className="form-select w-full" onChange={e => { appendToQuery(e.target.value); e.target.value = ''; }}>
                            <option value="">Color</option>
                            {COLORS_EN.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                            className="form-input w-full"
                            placeholder="ZIP Code..."
                            onBlur={e => { if (e.target.value.length === 5) appendToQuery(`en ${e.target.value}`); }}
                            onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.length === 5) { e.preventDefault(); appendToQuery(`en ${e.currentTarget.value}`); e.currentTarget.value = ''; } }}
                            maxLength={5}
                        />
                    </div>

                    {liveParsePreview && (
                        <div className="chips-row mb-12">
                            {liveParsePreview.year && <span className="chip"><span className="chip-label">Año</span> {liveParsePreview.year}</span>}
                            {liveParsePreview.make && <span className="chip"><span className="chip-label">Marca</span> {liveParsePreview.make}</span>}
                            {(liveParsePreview.model || liveParsePreview.model_free) && (
                                <span className="chip"><span className="chip-label">Modelo</span> {liveParsePreview.model ?? liveParsePreview.model_free}</span>
                            )}
                            {liveParsePreview.color && <span className="chip"><span className="chip-label">Color</span> {liveParsePreview.color}</span>}
                            {liveParsePreview.location_raw && <span className="chip">📍 {liveParsePreview.location_raw}</span>}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-6">
                        <button id="btn-search-chat" className="btn btn-primary btn-lg w-full sm:w-auto" onClick={handleSearchChat} disabled={loading || !query.trim()}>
                            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Buscando...</> : '⚡ Buscar Ahora'}
                        </button>
                        <button className="btn btn-ghost w-full sm:w-auto" onClick={() => { setQuery(''); setParsed(null); setListings([]); setError(''); setLocationLabel(''); setFmv(null); }}>
                            Limpiar
                        </button>
                    </div>

                    {!listings.length && !loading && !error && (
                        <div className="mt-16">
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>SUGERENCIAS</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {SUGGESTIONS.map(s => (
                                    <button key={s} className="btn btn-ghost btn-sm" onClick={() => { setQuery(s); }}>
                                        <span style={{ fontSize: 11 }}>🔎</span> {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="alert alert-danger mb-16"><span className="alert-icon">⚠️</span>{error}</div>}
            {
                !error && !loading && listings.length === 0 && query && !parsed && (
                    <div className="alert alert-neutral mb-16">
                        <span className="alert-icon">ℹ️</span> No se encontraron vehículos activos con estos criterios. Intenta ampliar tu búsqueda.
                    </div>
                )
            }

            {/* FMV stats */}
            {
                fmv && (
                    <div className="stat-grid mb-20">
                        <div className="stat-tile">
                            <span className="stat-label">Resultados</span>
                            <span className="stat-value">{total.toLocaleString()}</span>
                            <span className="stat-sub">{locationLabel}</span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Precio Mínimo</span>
                            <span className="stat-value" style={{ color: 'var(--green)' }}>{formatPrice(fmv?.low)}</span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Promedio Mercado</span>
                            <span className="stat-value">{formatPrice(fmv?.avg)}</span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Mediana</span>
                            <span className="stat-value">{formatPrice(fmv?.median)}</span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Precio Máximo</span>
                            <span className="stat-value" style={{ color: 'var(--red)' }}>{formatPrice(fmv?.high)}</span>
                        </div>
                        <div className="stat-tile">
                            <span className="stat-label">Con DOM &gt; 45 días</span>
                            <span className="stat-value" style={{ color: 'var(--yellow)' }}>
                                {listings.filter(l => safeInt(l.dom) > 45).length}
                            </span>
                            <span className="stat-sub">Alta presión de rotación</span>
                        </div>
                    </div>
                )
            }

            {/* Results */}
            {
                listings.length > 0 && (
                    <>
                        <div className="flex items-center justify-between mb-6 mt-8">
                            <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                                Available Inventory
                                <span className="text-sm font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{listings.length} Results</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">Sort by:</span>
                                <select className="bg-transparent border-none text-sm font-semibold text-primary focus:ring-0">
                                    <option>Best Match</option>
                                    <option>Lowest Price</option>
                                </select>
                            </div>
                        </div>

                        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {sortedListings.map((lst, i) => {
                                const build = lst.build ?? {};
                                const dealer = lst.dealer ?? lst.mc_dealership ?? {};
                                const fallbackImg = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzsaimtASWsVrYKV5x2QYSO1SCOCGLCOgb9MhkgBuS_RRc2Gw2qulJPzvhLgSRlt-dnjFc4nyLinD6HrnS0n7Dn1sNyQYFowchisEvtNYTZtP_ApjwSpSIMddA0U4_C_Sh3k4t21EjaUOi5TeOKuhRF_iVRwi3Nm1Pnl__D57Ab160YIgMYid-_LgB2oM_G4vG2mU4359qJu-N6OoLWBnGt8ln5K1TSEaGnzsGuQyQ-p98R822--zPOTVzlNUHitML8nBrosHFEmCA';
                                const photo = lst.media?.photo_links?.[0] || fallbackImg;
                                const dom = safeInt(lst.dom);
                                const fmvMedian = fmv?.median;

                                return (
                                    <StaggerItem key={lst.id ?? i}>
                                        <GlassCard className="group flex flex-col h-full justify-between">
                                            <div className="relative aspect-video bg-white/5">
                                                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={photo} alt={lst.heading || 'Car'} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-surface-dark to-transparent opacity-60"></div>
                                                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                                                    {lst.price && fmvMedian && lst.price < fmvMedian && (
                                                        <span className="bg-accent-mint/90 backdrop-blur text-background-dark text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wide flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">payments</span> Competitive Price
                                                        </span>
                                                    )}
                                                    {dom > 45 && (
                                                        <span className="bg-red-500/90 backdrop-blur text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wide flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">local_fire_department</span> High DOM
                                                        </span>
                                                    )}
                                                </div>
                                                <WatchlistButton listing={lst} />
                                            </div>

                                            <div className="p-5 flex-1 flex flex-col justify-between">
                                                <div className="flex justify-between items-start mb-2 gap-4">
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-100 group-hover:text-primary transition-colors line-clamp-1">
                                                            {lst.heading || `${build.year ?? parsed?.year} ${build.make ?? parsed?.make} ${build.model ?? parsed?.model} ${build.trim ?? ''}`}
                                                        </h4>
                                                        <p className="text-sm text-slate-400 capitalize truncate">{lst.exterior_color || 'Color N/A'} • {dealer.city || 'Localiza'}, {dealer.state || ''}</p>
                                                    </div>
                                                    <span className="text-xl font-black text-primary shrink-0">{formatPrice(lst.price)}</span>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 border-y border-white/5 py-4 my-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Mileage</span>
                                                        <span className="text-sm font-semibold text-slate-200">{safeInt(lst.miles).toLocaleString()} mi</span>
                                                    </div>
                                                    <div className="flex flex-col border-x border-white/5 px-3">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">DOM</span>
                                                        <span className={`text-sm font-semibold ${dom > 60 ? 'text-red-400' : 'text-slate-200'}`}>
                                                            {dom ? `${dom} Days` : '--'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Est. Margin</span>
                                                        <span className={`text-sm font-semibold ${lst.price && fmvMedian && fmvMedian > lst.price ? 'text-green-400' : 'text-slate-400'}`}>
                                                            {lst.price && fmvMedian && fmvMedian > lst.price ? `+${formatPrice(fmvMedian - lst.price)}` : '--'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button onClick={() => window.location.href = `/vin?vin=${lst.vin}`} className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold py-2 rounded-lg transition-all border border-primary/20">
                                                    View Market Analysis
                                                </button>
                                            </div>
                                        </GlassCard>
                                    </StaggerItem>
                                );
                            })}
                        </StaggerContainer>
                    </>
                )
            }

            {
                loading && (
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {[...Array(6)].map((_, i) => (
                            <StaggerItem key={i}>
                                <GlassCard className="p-0">
                                    <AnimatedSkeleton className="h-48 w-full rounded-none" />
                                    <div className="p-5 space-y-4">
                                        <AnimatedSkeleton className="h-6 w-3/4" />
                                        <AnimatedSkeleton className="h-4 w-1/2" />
                                        <div className="grid grid-cols-3 gap-2 py-4">
                                            <AnimatedSkeleton className="h-10 w-full" />
                                            <AnimatedSkeleton className="h-10 w-full" />
                                            <AnimatedSkeleton className="h-10 w-full" />
                                        </div>
                                    </div>
                                </GlassCard>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                )
            }
        </div >
    );
}

