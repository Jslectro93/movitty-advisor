export type HistoryType = 'chat' | 'filters' | 'vin';

export interface HistoryItem {
    type: HistoryType;
    query: string;
    url: string;
    timestamp: number;
}

const STORAGE_KEY = 'movitty_history';
const MAX_ITEMS = 10;

export function saveSearch(item: Omit<HistoryItem, 'timestamp'>) {
    if (typeof window === 'undefined') return;

    try {
        const current = getSearches();

        // Remove duplicates if the URL is the exact same
        const filtered = current.filter(x => x.url !== item.url);

        // Add new at the beginning
        filtered.unshift({ ...item, timestamp: Date.now() });

        // Cap at max limit
        const trimmed = filtered.slice(0, MAX_ITEMS);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        // Ignore errors (e.g. private mode)
    }
}

export function getSearches(): HistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) return JSON.parse(data);
    } catch { }
    return [];
}

export function clearSearches() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { }
}
