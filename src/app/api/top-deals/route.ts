import { NextResponse } from 'next/server';
import { API_KEY, BASE_URL, calcFMV, safeInt, type Listing } from '@/lib/marketcheck';

export const dynamic = 'force-dynamic';

function getSecondsUntilNext10AM() {
    const now = new Date();
    const target = new Date();
    target.setHours(10, 0, 0, 0); // 10:00 AM local time

    if (now.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1);
    }

    return Math.floor((target.getTime() - now.getTime()) / 1000);
}
// The popular cars we will track for deals
const TRACKED_VICS = [
    { label: 'Sedán', make: 'Toyota', model: 'Corolla', year: '2024' },
    { label: 'SUV', make: 'Honda', model: 'CR-V', year: '2023' },
    { label: 'Pickup', make: 'Ford', model: 'F-150', year: '2022' },
];

export async function GET() {
    try {
        const topDeals = await Promise.all(TRACKED_VICS.map(async (vic) => {
            const params = new URLSearchParams();
            params.set('api_key', API_KEY);
            params.set('make', vic.make);
            params.set('model', vic.model);
            params.set('year', vic.year);
            params.set('rows', '50');     // get enough sample size
            params.set('car_type', 'used'); // only used cars have reliable transparent pricing
            params.set('sort_by', 'dom'); // we want normal cars to sample FMV
            params.set('sort_order', 'desc');
            params.set('price_min', '1000'); // filter out bad data
            params.set('include', 'media'); // Fetch listing photos directly

            const r = await fetch(`${BASE_URL}/search/car/active?${params}`);
            if (!r.ok) return null;

            const data = await r.json();
            const listings: Listing[] = data.listings || [];
            if (!listings.length) return null;

            const fmv = calcFMV(listings, data.num_found || listings.length);
            if (!fmv || !fmv.avg) {
                return null;
            }

            // We ensure it has a photo, has a price, and we sort by price asc to find the absolute lowest in this 50-car sample
            const validWithPhotos = listings
                .filter(l => safeInt(l.price) > 0 && l.media?.photo_links?.length)
                .sort((a, b) => safeInt(a.price) - safeInt(b.price));

            const bestDeal = validWithPhotos[0];

            if (!bestDeal) {
                return null;
            }

            const price = safeInt(bestDeal.price);
            const savings = fmv.avg - price;

            // Only keep it if it's an actual 'deal' (at least 5% off FMV or $1000)
            if (savings < fmv.avg * 0.05 && savings < 1000) {
                return null;
            }

            return {
                segment: vic.label,
                listing: bestDeal,
                fmvAvg: fmv.avg,
                savings: savings
            };
        }));

        const validDeals = topDeals.filter(Boolean);

        const maxAge = getSecondsUntilNext10AM();
        return NextResponse.json({
            timestamp: Date.now(),
            nextUpdateAt: new Date(Date.now() + maxAge * 1000).toISOString(),
            deals: validDeals
        }, {
            headers: {
                'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=60`
            }
        });

    } catch (err) {
        console.error('Error fetching top deals:', err);
        return NextResponse.json({ error: 'Failed to fetch top deals' }, { status: 500 });
    }
}
