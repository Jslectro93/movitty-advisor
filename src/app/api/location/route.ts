import { NextRequest, NextResponse } from 'next/server';

const TOP_STATES = ['fl', 'tx', 'ca', 'ny', 'nj', 'ga', 'nc', 'az', 'co', 'wa', 'il', 'oh', 'pa', 'mi', 'va', 'tn', 'sc', 'md', 'mn', 'mo'];

export async function GET(req: NextRequest) {
    const city = new URL(req.url).searchParams.get('city');
    if (!city) return NextResponse.json({ error: 'city required' }, { status: 400 });

    // Try Nominatim first
    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', USA')}&format=json&addressdetails=1&limit=1&countrycodes=us`,
            { headers: { 'User-Agent': 'MovittyApp/1.0' }, next: { revalidate: 86400 } }
        );
        const results = await r.json();
        if (results?.length) {
            const addr = results[0].address ?? {};
            const zip = (addr.postcode ?? '').replace(/\s/g, '').slice(0, 5);
            if (zip && /^\d{5}$/.test(zip)) {
                return NextResponse.json({
                    zip,
                    city: addr.city ?? addr.town ?? addr.village ?? city,
                    state: addr.state ?? '',
                });
            }
        }
    } catch { }

    // Fallback: Zippopotam across common states
    for (const state of TOP_STATES) {
        try {
            const r = await fetch(`https://api.zippopotam.us/us/${state}/${city}`, { next: { revalidate: 86400 } });
            if (r.ok) {
                const data = await r.json();
                const place = data.places?.[0] ?? {};
                const zip = String(place['post code'] ?? '').slice(0, 5);
                if (zip) return NextResponse.json({ zip, city: place['place name'] ?? city, state: data.state ?? '' });
            }
        } catch { }
    }

    return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
