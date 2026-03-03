import { NextRequest, NextResponse } from 'next/server';
import { API_KEY, BASE_URL } from '@/lib/marketcheck';

export async function POST(req: NextRequest) {
    try {
        const { vins } = await req.json();
        if (!vins || !Array.isArray(vins) || vins.length === 0) {
            return NextResponse.json({ listings: [] });
        }

        // Fetch active listing data for each saved VIN in parallel
        const fetchVin = async (vin: string) => {
            const r = await fetch(`${BASE_URL}/search/car/active?api_key=${API_KEY}&vin=${vin}&include=media`, {
                cache: 'no-store'
            });
            if (r.ok) {
                const data = await r.json();
                if (data && data.listings && data.listings.length > 0) {
                    return data.listings[0]; // The active listing
                }
            }
            return null;
        };

        const results = await Promise.all(vins.map((vin: string) => fetchVin(vin)));
        const listings = results.filter(Boolean);

        return NextResponse.json({ listings });
    } catch (e) {
        console.error('Watchlist sync error:', e);
        return NextResponse.json({ error: 'Server error during sync' }, { status: 500 });
    }
}
