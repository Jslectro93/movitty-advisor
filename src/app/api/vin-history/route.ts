import { NextRequest, NextResponse } from 'next/server';
import { API_KEY, BASE_URL } from '@/lib/marketcheck';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const vin = searchParams.get('vin');
    if (!vin || vin.length !== 17) {
        return NextResponse.json({ error: 'VIN inválido' }, { status: 400 });
    }

    try {
        const r = await fetch(`${BASE_URL}/history/car/${vin}?api_key=${API_KEY}`, {
            next: { revalidate: 300 },
        });
        if (!r.ok) return NextResponse.json({ error: `HTTP ${r.status}` }, { status: r.status });
        const data = await r.json();
        const listings = Array.isArray(data) ? data : data.listings ?? [];
        return NextResponse.json({ listings });
    } catch (e) {
        return NextResponse.json({ error: 'connection_error' }, { status: 502 });
    }
}
