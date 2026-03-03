import { NextRequest, NextResponse } from 'next/server';
import { API_KEY, BASE_URL } from '@/lib/marketcheck';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const vin = searchParams.get('vin');
    if (!vin || vin.length !== 17) {
        return NextResponse.json({ error: 'VIN inválido' }, { status: 400 });
    }

    try {
        const [historyRes, activeRes] = await Promise.all([
            fetch(`${BASE_URL}/history/car/${vin}?api_key=${API_KEY}`, { next: { revalidate: 300 } }),
            fetch(`${BASE_URL}/search/car/active?api_key=${API_KEY}&vin=${vin}&include=media`, { next: { revalidate: 300 } })
        ]);

        if (!historyRes.ok) return NextResponse.json({ error: `HTTP ${historyRes.status}` }, { status: historyRes.status });

        const historyData = await historyRes.json();
        const listings = Array.isArray(historyData) ? historyData : historyData.listings ?? [];

        let activeListing = null;
        if (activeRes.ok) {
            const activeData = await activeRes.json();
            if (activeData.listings && activeData.listings.length > 0) {
                activeListing = activeData.listings[0];
            }
        }

        return NextResponse.json({ listings, activeListing });
    } catch (e) {
        return NextResponse.json({ error: 'connection_error' }, { status: 502 });
    }
}
