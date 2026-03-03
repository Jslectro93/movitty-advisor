'use client';

import { useState, useEffect } from 'react';
import { isInWatchlist, saveToWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { Listing } from '@/lib/marketcheck';

interface Props {
    listing: Listing;
    className?: string;
}

export function WatchlistButton({ listing, className }: Props) {
    const [saved, setSaved] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setMounted(true);
        if (!listing.id) return;

        setSaved(isInWatchlist(listing.id));

        const handleUpdate = () => {
            setSaved(isInWatchlist(listing.id!));
        };

        window.addEventListener('watchlist_updated', handleUpdate);
        return () => window.removeEventListener('watchlist_updated', handleUpdate);
    }, [listing.id]);

    if (!listing.id || !mounted) return null;

    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (saved) {
                    removeFromWatchlist(listing.id!);
                } else {
                    saveToWatchlist(listing);
                }
            }}
            className={className || `absolute top-3 right-3 backdrop-blur p-2 rounded-full transition-all duration-300 ${saved ? 'bg-red-500/90 text-white hover:bg-red-600 scale-110 shadow-lg shadow-red-500/20' : 'bg-black/40 text-white hover:bg-primary hover:scale-110'}`}
            title={saved ? "Quitar de Watchlist" : "Guardar en Watchlist"}
        >
            <span className={`material-symbols-outlined text-sm transition-all ${saved ? 'fill-1' : ''}`}>favorite</span>
        </button>
    );
}
