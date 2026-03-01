import { NextRequest, NextResponse } from 'next/server';
import { API_KEY, BASE_URL } from '@/lib/marketcheck';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const params = new URLSearchParams();
    params.set('api_key', API_KEY);
    params.set('price_min', '1');
    params.set('rows', searchParams.get('rows') ?? '50');
    params.set('sort_by', 'dom');
    params.set('sort_order', 'desc');

    const fields = ['make', 'model', 'year', 'exterior_color', 'zip', 'radius'];
    for (const f of fields) {
        const v = searchParams.get(f);
        if (v) params.set(f, v);
    }

    try {
        const r = await fetch(`${BASE_URL}/search/car/active?${params}`, {
            next: { revalidate: 120 },
        });
        if (r.status === 422) {
            const result = await r.json().catch(() => ({}));
            return NextResponse.json({
                error: `Filtros inválidos (422). Marketcheck rechazó la búsqueda: ${JSON.stringify(result)}. Params enviados: ${params.toString()}`
            }, { status: 422 });
        }
        if (!r.ok) return NextResponse.json({ error: `Ocurrió un error en el servidor (HTTP ${r.status})` }, { status: r.status });
        return NextResponse.json(await r.json());
    } catch {
        return NextResponse.json({ error: 'connection_error' }, { status: 502 });
    }
}
