'use client';

import { useState } from 'react';
import { Listing, formatPrice, safeInt } from '@/lib/marketcheck';
import { GlassCard } from '@/components/ui/GlassCard';
import { WatchlistButton } from '@/components/ui/WatchlistButton';
import Link from 'next/link';

export default function ComparePage() {
    const [vins, setVins] = useState<string[]>(['', '', '']);
    const [vehicles, setVehicles] = useState<(Listing | null)[]>([null, null, null]);
    const [loading, setLoading] = useState(false);

    const loadVehicle = async (index: number, vin: string) => {
        if (!vin || vin.length !== 17) return;

        try {
            setLoading(true);
            const r = await fetch(`/api/search?vin=${vin}`);
            if (r.ok) {
                const data = await r.json();
                if (data.listings && data.listings.length > 0) {
                    const newVehicles = [...vehicles];
                    newVehicles[index] = data.listings[0];
                    setVehicles(newVehicles);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const removeVehicle = (index: number) => {
        const newVehicles = [...vehicles];
        newVehicles[index] = null;
        setVehicles(newVehicles);

        const newVins = [...vins];
        newVins[index] = '';
        setVins(newVins);
    };

    // Calculate Best Metrics to highlight
    const validVehicles = vehicles.filter((v): v is Listing => v !== null);

    let lowestPrice = Infinity;
    let lowestDom = Infinity;
    let lowestMiles = Infinity;

    if (validVehicles.length > 1) {
        lowestPrice = Math.min(...validVehicles.map(v => v.price || Infinity));
        lowestDom = Math.min(...validVehicles.map(v => safeInt(v.dom) || Infinity));
        lowestMiles = Math.min(...validVehicles.map(v => safeInt(v.miles) || Infinity));
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="section-header mb-8 md:mb-12">
                <div>
                    <h1 className="section-title flex items-center gap-3">
                        <span className="material-symbols-outlined text-purple-500">compare_arrows</span>
                        Radar Comparativo
                    </h1>
                    <p className="section-desc">Enfrenta hasta 3 vehículos cara a cara para aislar el mejor trato del mercado.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[0, 1, 2].map((i) => {
                    const v = vehicles[i];

                    return (
                        <div key={i} className="flex flex-col gap-4">
                            {/* Input Cell */}
                            <GlassCard className="p-4 border-dashed border-white/20">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Vehículo {i + 1}</label>
                                <div className="flex gap-2">
                                    <input
                                        className="form-input text-sm uppercase font-mono"
                                        placeholder="Ingresar VIN..."
                                        maxLength={17}
                                        value={vins[i]}
                                        onChange={(e) => {
                                            const newVins = [...vins];
                                            newVins[i] = e.target.value.toUpperCase();
                                            setVins(newVins);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') loadVehicle(i, vins[i]);
                                        }}
                                        disabled={v !== null}
                                    />
                                    {v ? (
                                        <button onClick={() => removeVehicle(i)} className="btn bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3">
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                    ) : (
                                        <button onClick={() => loadVehicle(i, vins[i])} disabled={loading || vins[i].length !== 17} className="btn btn-primary px-3">
                                            <span className="material-symbols-outlined text-[18px]">search</span>
                                        </button>
                                    )}
                                </div>
                            </GlassCard>

                            {/* Data Column */}
                            {v ? (
                                <GlassCard className="flex flex-col flex-1 overflow-hidden relative">
                                    <WatchlistButton listing={v} className="absolute top-3 left-3 z-10 bg-black/40 text-white p-2 rounded-full hover:bg-primary" />
                                    <div className="h-48 relative bg-white/5">
                                        <img src={v.media?.photo_links?.[0] || ''} alt="Car" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="font-bold text-lg leading-tight mb-4">
                                            {v.build?.year} {v.build?.make} {v.build?.model}
                                        </h3>

                                        <div className="space-y-3 flex-1">
                                            {/* Price Row */}
                                            <div className={`p-3 rounded-lg border flex justify-between items-center ${v.price === lowestPrice && validVehicles.length > 1 ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/5'}`}>
                                                <span className="text-xs text-slate-400 font-bold uppercase">Precio</span>
                                                <span className={`text-xl font-black ${v.price === lowestPrice && validVehicles.length > 1 ? 'text-green-400' : 'text-white'}`}>
                                                    {formatPrice(v.price)}
                                                </span>
                                            </div>

                                            {/* Miles Row */}
                                            <div className={`p-3 rounded-lg border flex justify-between items-center ${safeInt(v.miles) === lowestMiles && validVehicles.length > 1 ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/5'}`}>
                                                <span className="text-xs text-slate-400 font-bold uppercase">Millas</span>
                                                <span className={`font-mono ${safeInt(v.miles) === lowestMiles && validVehicles.length > 1 ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
                                                    {v.miles?.toLocaleString()} mi
                                                </span>
                                            </div>

                                            {/* DOM Row */}
                                            <div className={`p-3 rounded-lg border flex justify-between items-center ${safeInt(v.dom) === lowestDom && validVehicles.length > 1 ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/5'}`}>
                                                <span className="text-xs text-slate-400 font-bold uppercase">DOM (Días)</span>
                                                <span className={`font-mono ${safeInt(v.dom) === lowestDom && validVehicles.length > 1 ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
                                                    {v.dom || '--'}
                                                </span>
                                            </div>

                                            <div className="p-3 rounded-lg border bg-white/5 border-white/5 flex justify-between items-center">
                                                <span className="text-xs text-slate-400 font-bold uppercase">Dealer</span>
                                                <span className="text-xs font-semibold text-slate-300 truncate max-w-[120px] text-right" title={v.dealer?.name}>
                                                    {v.dealer?.name || 'Privado'}
                                                </span>
                                            </div>
                                        </div>

                                        <Link href={`/vin?v=${v.vin}`} className="mt-6 w-full">
                                            <button className="w-full btn bg-primary/20 text-primary border-primary/20 hover:bg-primary hover:text-white">
                                                Evaluar VIN
                                            </button>
                                        </Link>
                                    </div>
                                </GlassCard>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-dark border border-white/5 rounded-2xl border-dashed opacity-50">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-600">directions_car</span>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Esperando Vehículo</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
