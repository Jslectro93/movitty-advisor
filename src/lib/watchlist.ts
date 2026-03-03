import { Listing } from './marketcheck';

const WATCHLIST_KEY = 'movitty_watchlist';

export interface WatchlistItem {
    id: string; // The listing ID or VIN
    vin: string;
    addedAt: number; // Timestamp
    listing: Listing; // The snapshot of the listing when it was saved
}

export function getWatchlist(): WatchlistItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(WATCHLIST_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error reading watchlist from local storage", e);
        return [];
    }
}

export function saveToWatchlist(listing: Listing): void {
    if (typeof window === 'undefined' || !listing.id) return;

    const current = getWatchlist();
    // Check if it already exists
    if (!current.some(item => item.id === listing.id)) {
        const newItem: WatchlistItem = {
            id: listing.id,
            vin: listing.vin || '',
            addedAt: Date.now(),
            listing
        };
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify([newItem, ...current]));

        // Dispatch custom event so UI can react immediately without polling
        window.dispatchEvent(new Event('watchlist_updated'));
    }
}

export function removeFromWatchlist(id: string): void {
    if (typeof window === 'undefined') return;

    const current = getWatchlist();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));

    window.dispatchEvent(new Event('watchlist_updated'));
}

export function isInWatchlist(id: string): boolean {
    if (typeof window === 'undefined') return false;
    const current = getWatchlist();
    return current.some(item => item.id === id);
}

export function clearWatchlist(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(WATCHLIST_KEY);
    window.dispatchEvent(new Event('watchlist_updated'));
}
