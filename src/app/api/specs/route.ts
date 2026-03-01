import { NextRequest, NextResponse } from 'next/server';
import { API_KEY, BASE_URL } from '@/lib/marketcheck';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const vin = searchParams.get('vin');
    if (!vin || vin.length !== 17) {
        return NextResponse.json({ error: 'VIN inválido' }, { status: 400 });
    }

    try {
        const r = await fetch(`${BASE_URL}/decode/car/${vin}/specs?api_key=${API_KEY}`, {
            next: { revalidate: 3600 },
        });
        if (r.status === 422) {
            return NextResponse.json({ error: 'VIN no procesable (422). Es posible que el número sea incorrecto o el vehículo no esté en la base de datos.' }, { status: 422 });
        }
        if (!r.ok) return NextResponse.json({ error: `Ocurrió un error en el servidor (HTTP ${r.status})` }, { status: r.status });
        return NextResponse.json(await r.json());
    } catch {
        return NextResponse.json({ error: 'connection_error' }, { status: 502 });
    }
}
