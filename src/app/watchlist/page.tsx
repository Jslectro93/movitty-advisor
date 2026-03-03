'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWatchlist, removeFromWatchlist, type WatchlistItem } from '@/lib/watchlist';
import { GlassCard } from '@/components/ui/GlassCard';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { formatPrice, type Listing } from '@/lib/marketcheck';

export default function WatchlistPage() {
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [mounted, setMounted] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const loadWatchlist = () => {
        setItems(getWatchlist());
    };

    useEffect(() => {
        setMounted(true);
        loadWatchlist();

        window.addEventListener('watchlist_updated', loadWatchlist);
        return () => window.removeEventListener('watchlist_updated', loadWatchlist);
    }, []);

    useEffect(() => {
        if (!mounted || items.length === 0) return;

        let cancelled = false;
        const sync = async () => {
            setSyncing(true);
            try {
                const vins = items.map(i => i.vin).filter(Boolean);
                const r = await fetch('/api/watchlist-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vins })
                });
                if (r.ok && !cancelled) {
                    const data = await r.json();
                    if (data.listings && Array.isArray(data.listings)) {
                        setItems(current => {
                            return current.map(item => {
                                const live = data.listings.find((l: Listing) => l.vin === item.vin);
                                if (live) {
                                    // Merge live pricing but keep addedAt
                                    return { ...item, liveListing: live } as WatchlistItem & { liveListing: Listing };
                                }
                                return item;
                            });
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to sync watchlist", e);
            } finally {
                if (!cancelled) setSyncing(false);
            }
        };

        // Only run sync once on mount after items are loaded
        const hasLive = items.some((i) => 'liveListing' in i);
        if (!hasLive) sync();

        return () => { cancelled = true; };
    }, [mounted, items.length]);

    if (!mounted) return null;

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="section-header mb-8 md:mb-12 flex justify-between items-end">
                <div>
                    <h1 className="section-title flex items-center gap-3">
                        <span className="material-symbols-outlined text-red-500">favorite</span>
                        CRM de Inventario
                    </h1>
                    <p className="section-desc">Monitorea los vehículos guardados para rastrear caídas de precio y días en mercado.</p>
                </div>
                {syncing && (
                    <div className="hidden sm:flex items-center gap-2 text-primary font-bold text-xs bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        Status Sync...
                    </div>
                )}
            </div>

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-surface-dark/40 rounded-2xl border border-white/5 shadow-glass text-center gap-4">
                    <span className="material-symbols-outlined text-[64px] text-slate-600 mb-2">inventory_2</span>
                    <h3 className="text-xl font-bold text-white">Tu inventario está vacío</h3>
                    <p className="text-slate-400 max-w-sm">Guarda vehículos desde la vista de Smart Search para darles seguimiento continuo aquí.</p>
                    <Link href="/smart-search">
                        <button className="btn btn-primary mt-4">
                            Ir a Smart Search
                        </button>
                    </Link>
                </div>
            ) : (
                <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.map((item) => {
                        const { id, vin, addedAt, listing } = item;
                        // Use liveListing if available, otherwise fallback to the saved snapshot
                        const liveListing = (item as any).liveListing;
                        const displayListing = liveListing || listing;

                        const b = displayListing.build || {};
                        const title = `${b.year || ''} ${b.make || ''} ${b.model || ''}`.trim();
                        const photo = displayListing.media?.photo_links?.[0] || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDaYraoEM4VCVTiccmoolnphlDe_yI5VZqCVAC6PRDhhGSH6jEeXSphof_bnZd5U18JWbYJIKMEps0_NzcGfJO3a6l7Tl8G6JiUqIIAMmDeCGauNA4oEhghp2yT2C3bViBSe3AwZ5YhStDmIoLARI1shRfp5B2HI56aU-IYDYhFYZSL-nZlpsRiWt7JOlrEBNhc8JvJ66WkAcM_dpjn0Uc4JEiRUAvZx668yZJiozixqudKLNnKQX3z1BH7ZFexVGgsDt4igAdTCLXQ';

                        const savedPrice = listing.price || 0;
                        const livePrice = liveListing?.price || 0;
                        const priceDrop = liveListing && livePrice < savedPrice ? savedPrice - livePrice : 0;

                        return (
                            <StaggerItem key={id}>
                                <GlassCard className="flex flex-col h-full overflow-hidden group">
                                    <div className="relative h-48 overflow-hidden bg-white/5">
                                        <img src={photo} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent opacity-80"></div>

                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                removeFromWatchlist(id);
                                            }}
                                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-background-dark/80 backdrop-blur-md rounded-full border border-white/10 text-red-500 hover:scale-110 hover:bg-red-500/20 transition-all z-10"
                                            title="Remover"
                                        >
                                            <span className="material-symbols-outlined text-[18px] fill-1">favorite</span>
                                        </button>

                                        {priceDrop > 0 && (
                                            <div className="absolute top-3 left-3 bg-green-500/90 backdrop-blur border border-green-400 px-2 py-1 rounded text-white font-black text-[10px] uppercase shadow-lg shadow-green-500/20 flex items-center gap-1 z-10 animate-pulse-slow">
                                                <span className="material-symbols-outlined text-[12px]">trending_down</span>
                                                Baja de {formatPrice(priceDrop)}
                                            </div>
                                        )}

                                        <div className="absolute bottom-3 left-3 flex flex-col gap-1">
                                            <div className="bg-background-dark/80 backdrop-blur border border-white/10 px-2 py-1 rounded text-white font-bold text-sm shadow-lg leading-none">
                                                {formatPrice(displayListing.price)}
                                            </div>
                                            <div className="text-[10px] text-slate-300 font-medium">
                                                Guardado el {new Date(addedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 flex flex-col flex-1">
                                        <h3 className="font-bold text-white text-lg leading-tight mb-1 line-clamp-2" title={title}>{title}</h3>
                                        <p className="text-slate-400 text-xs mb-3 font-mono">{vin}</p>

                                        <div className="mt-auto pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-slate-500 block">Millas</span>
                                                <span className="text-slate-200 font-semibold">{displayListing.miles ? displayListing.miles.toLocaleString() : 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block">Color</span>
                                                <span className="text-slate-200 font-semibold truncate block" title={displayListing.exterior_color}>{displayListing.exterior_color || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <Link href={`/vin?v=${vin}`} className="w-full mt-4">
                                            <button className="w-full py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary hover:text-white rounded-lg transition-colors text-sm font-semibold flex items-center justify-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">barcode_scanner</span>
                                                Evaluar VIN
                                            </button>
                                        </Link>
                                    </div>
                                </GlassCard>
                            </StaggerItem>
                        );
                    })}
                </StaggerContainer>
            )}
        </div>
    );
}
