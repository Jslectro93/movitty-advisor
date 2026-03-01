'use client';
import { useState, useRef, useEffect } from 'react';
import { saveSearch } from '@/lib/history';
import { parseQuery, type ParsedQuery } from '@/lib/parser';
import { type Listing, type FMV, calcFMV, getOpportunityFlags, formatPrice, safeInt, daysSinceUnix } from '@/lib/marketcheck';

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

    const [color, setColor] = useState('');
    const [zip, setZip] = useState('');
    const [radius, setRadius] = useState('100');
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
            setQuery(q);
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
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="section-header mb-20">
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
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                        <select className="form-select" style={{ width: 'auto', minWidth: 140 }} onChange={e => { appendToQuery(e.target.value); e.target.value = ''; }}>
                            <option value="">Marca</option>
                            {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                                className="form-input"
                                placeholder="Modelo"
                                style={{ width: 120 }}
                                onBlur={e => { if (e.target.value.trim()) { appendToQuery(e.target.value.trim()); e.target.value = ''; } }}
                                onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { e.preventDefault(); appendToQuery(e.currentTarget.value.trim()); e.currentTarget.value = ''; } }}
                            />
                        </div>
                        <select className="form-select" style={{ width: 'auto', minWidth: 120 }} onChange={e => { appendToQuery(e.target.value); e.target.value = ''; }}>
                            <option value="">Año</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select className="form-select" style={{ width: 'auto', minWidth: 140 }} onChange={e => { appendToQuery(e.target.value); e.target.value = ''; }}>
                            <option value="">Color</option>
                            {COLORS_EN.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                                className="form-input"
                                placeholder="ZIP Code..."
                                style={{ width: 120 }}
                                onBlur={e => { if (e.target.value.length === 5) appendToQuery(`en ${e.target.value}`); }}
                                onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.length === 5) { e.preventDefault(); appendToQuery(`en ${e.currentTarget.value}`); e.currentTarget.value = ''; } }}
                                maxLength={5}
                            />
                        </div>
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

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button id="btn-search-chat" className="btn btn-primary btn-lg" onClick={handleSearchChat} disabled={loading || !query.trim()}>
                            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Buscando...</> : '⚡ Buscar Ahora'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { setQuery(''); setParsed(null); setListings([]); setError(''); setLocationLabel(''); setFmv(null); }}>
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
                        <div className="section-header mb-16 mt-8">
                            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Inventario Disponible</h2>
                            <span className="badge badge-accent">
                                {listings.length} mostrados
                            </span>
                        </div>
                        <div className="grid-cards">
                            {sortedListings.map((lst, i) => {
                                const build = lst.build ?? {};
                                const dealer = lst.dealer ?? lst.mc_dealership ?? {};
                                const flags = getOpportunityFlags(lst, fmv);
                                const dom = safeInt(lst.dom);

                                return (
                                    <div key={lst.id ?? i} className="listing-card">
                                        <div className="listing-card-header">
                                            <div>
                                                <div className="listing-title">
                                                    {build.year ?? parsed?.year} {build.make ?? parsed?.make} {build.model ?? parsed?.model} {build.trim ?? ''}
                                                </div>
                                                <div className="listing-meta" style={{ marginTop: 4 }}>
                                                    <span className="listing-meta-item">🎨 {lst.exterior_color ?? 'N/D'}</span>
                                                    <span className="listing-meta-item">📏 {safeInt(lst.miles).toLocaleString()} mi</span>
                                                    <span className="listing-meta-item" style={{ color: dom > 45 ? 'var(--red)' : dom > 30 ? 'var(--yellow)' : 'var(--text-secondary)' }}>
                                                        ⏱ {dom} días
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="listing-price">{formatPrice(lst.price)}</div>
                                        </div>

                                        {lst.msrp && lst.msrp !== lst.price && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>MSRP: {formatPrice(lst.msrp)}</div>
                                        )}

                                        <div className="listing-dealer">
                                            🏪 {dealer.name ?? 'N/D'} · {dealer.city}, {dealer.state}
                                        </div>

                                        {flags.length > 0 && (
                                            <div className="listing-flags">
                                                {flags.map(f => (
                                                    <span key={f.label} className={`badge ${f.type === 'negotiation' ? 'badge-yellow' : f.type === 'competitive' ? 'badge-green' : 'badge-red'}`}>
                                                        {f.type === 'negotiation' ? '🔥' : f.type === 'competitive' ? '💰' : '⚠️'} {f.label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {lst.vdp_url && (
                                            <a href={lst.vdp_url} target="_blank" rel="noopener" className="td-link" style={{ fontSize: 12 }}>
                                                Ver en dealer →
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )
            }

            {
                loading && (
                    <div className="grid-cards mt-20">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="listing-card">
                                <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }} />
                                <div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 8 }} />
                                <div className="skeleton" style={{ height: 14, width: '80%' }} />
                            </div>
                        ))}
                    </div>
                )
            }
        </div >
    );
}

