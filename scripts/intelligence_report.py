"""
╔══════════════════════════════════════════════════════════════╗
║       MOVITTY — Intelligence Report                         ║
║       Powered by Marketcheck API                            ║
╚══════════════════════════════════════════════════════════════╝

Genera un reporte completo de inteligencia de negociación para un VIN.
Combina: Ficha Técnica · Cronología de Precios · Fair Market Value
         Fortalezas de Negociación · Debilidades del Vendedor

Uso:
    python3 intelligence_report.py <VIN>

Ejemplo:
    python3 intelligence_report.py KL77LGEP4TC079564
"""

import sys
import re
import requests
from datetime import datetime, timezone

# ─── Configuración ────────────────────────────────────────────────
API_KEY      = "DmCy2HntmaaWGWWgApjMB0SlgSYP9Kd4"
BASE_URL     = "https://api.marketcheck.com/v2"

DOM_WEAK_SELLER_DAYS = 30      # días para considerar "vendedor en presión"
PRICE_ABOVE_MARKET   = 500     # $$ arriba del mercado = palanca de negociación
PRICE_BELOW_MARKET   = 500     # $$ debajo del mercado = fortaleza para el advisor
AGGRESSIVE_DROP      = 800     # caída de precio para considerarla "agresiva"


# ─── Helpers ──────────────────────────────────────────────────────

def get(path: str, params: dict = None) -> dict:
    """Hace una petición GET a la API y devuelve el JSON o un dict de error."""
    url     = f"{BASE_URL}/{path}"
    params  = {**(params or {}), "api_key": API_KEY}
    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        return {"_error": f"HTTP {e.response.status_code if e.response else '?'}"}
    except Exception as e:
        return {"_error": str(e)}


def iso_to_date(s) -> str:
    return s[:10] if s else "N/D"


def safe_int(v, default=0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def safe_price(v) -> str:
    try:
        return f"${int(v):,}"
    except (TypeError, ValueError):
        return "N/D"


def days_since_unix(ts) -> int:
    """Días desde un timestamp Unix (seg) hasta hoy."""
    try:
        then = datetime.fromtimestamp(int(ts), tz=timezone.utc)
        now  = datetime.now(tz=timezone.utc)
        return (now - then).days
    except Exception:
        return 0


def vehicle_name_from_vdp(vdp_url: str) -> str:
    try:
        m = re.search(r'/(\d{4})-([A-Za-z]+)-([A-Za-z0-9]+)', vdp_url)
        if m:
            return f"{m.group(1)} {m.group(2)} {m.group(3)}"
    except Exception:
        pass
    return ""


# ─── Fetch Functions ──────────────────────────────────────────────

def fetch_specs(vin: str) -> dict:
    return get(f"decode/car/{vin}/specs")


def fetch_history(vin: str) -> list:
    data = get(f"history/car/{vin}")
    if "_error" in data:
        return []
    raw = data if isinstance(data, list) else data.get("listings", [])
    return sorted(raw, key=lambda l: l.get("first_seen_at", 0))


def fetch_market(make: str, model: str, year) -> dict:
    """Busca listings activos para calcular el Fair Market Value de la zona."""
    data = get("search/car/active", {
        "make":       make,
        "model":      model,
        "year":       str(year),
        "price_min":  1,
        "rows":       50,
        "sort_by":    "dom",
        "sort_order": "desc",
    })
    return data


# ─── Análisis ─────────────────────────────────────────────────────

def build_price_timeline(history: list) -> list[dict]:
    """Construye cronología de cambios de precio."""
    timeline    = []
    last_price  = None
    for listing in history:
        price = safe_int(listing.get("price"))
        date  = iso_to_date(listing.get("first_seen_at_date"))
        if price > 0 and price != last_price:
            delta = (price - last_price) if last_price else 0
            timeline.append({
                "date":  date,
                "price": price,
                "delta": delta,          # positivo = subió, negativo = bajó
            })
            last_price = price
    return timeline


def calc_fair_market_value(market_data: dict) -> dict | None:
    """Calcula el Fair Market Value promedio + rango a partir del mercado activo."""
    listings = market_data.get("listings", [])
    if not listings:
        return None
    prices = [safe_int(l.get("price")) for l in listings if safe_int(l.get("price")) > 0]
    if not prices:
        return None
    prices.sort()
    avg   = int(sum(prices) / len(prices))
    low   = prices[0]
    high  = prices[-1]
    med   = prices[len(prices) // 2]
    count = market_data.get("num_found", len(prices))
    return {"avg": avg, "low": low, "high": high, "median": med, "sample": len(prices), "total": count}


# ─── Reporte ──────────────────────────────────────────────────────

def print_report(vin: str, specs: dict, history: list, market_data: dict) -> None:

    timeline = build_price_timeline(history)
    fmv      = calc_fair_market_value(market_data)

    # Datos del vehículo objetivo
    current_listing = history[-1] if history else {}
    first_listing   = history[0]  if history else {}

    first_seen_ts  = first_listing.get("first_seen_at")
    last_seen_date = iso_to_date(current_listing.get("last_seen_at_date")
                                  or current_listing.get("first_seen_at_date"))
    first_seen_date = iso_to_date(first_listing.get("first_seen_at_date"))
    days_on_market  = days_since_unix(first_seen_ts) if first_seen_ts else 0

    current_price = timeline[-1]["price"] if timeline else 0
    initial_price = timeline[0]["price"]  if timeline else 0
    total_drop    = current_price - initial_price   # negativo = bajó

    # Nombre del vehículo
    vdp_url      = first_listing.get("vdp_url", "")
    vehicle_name = vehicle_name_from_vdp(vdp_url) or f"{specs.get('year','')} {specs.get('make','')} {specs.get('model','')}"
    dealer_name  = (current_listing.get("dealer") or {}).get("name", "el dealer")
    dealer_city  = (current_listing.get("dealer") or {}).get("city", "")
    dealer_state = (current_listing.get("dealer") or {}).get("state", "")
    dealer_loc   = f"{dealer_city}, {dealer_state}".strip(", ")

    # Fortalezas y debilidades
    strengths = []
    weaknesses = []

    # — Debilidades del vendedor —
    if days_on_market > DOM_WEAK_SELLER_DAYS:
        weaknesses.append(
            f"El auto lleva {days_on_market} días en inventario "
            f"(publicado desde {first_seen_date}). El dealer tiene presión de rotación."
        )

    if total_drop < -AGGRESSIVE_DROP:
        weaknesses.append(
            f"El precio ya bajó {safe_price(abs(total_drop))} desde su publicación inicial "
            f"({safe_price(initial_price)} → {safe_price(current_price)}). "
            f"El vendedor ya está moviéndose — hay margen para pedir más."
        )

    biggest_drop = min((e["delta"] for e in timeline if e["delta"] < 0), default=0)
    if biggest_drop < -AGGRESSIVE_DROP:
        drop_entry = next(e for e in timeline if e["delta"] == biggest_drop)
        weaknesses.append(
            f"La rebaja más agresiva fue de {safe_price(abs(biggest_drop))} "
            f"el {drop_entry['date']}. Señal de urgencia por parte del dealer."
        )

    # — Fortalezas de negociación —
    if fmv:
        gap = current_price - fmv["avg"] if current_price else None
        if gap and gap > PRICE_ABOVE_MARKET:
            strengths.append(
                f"El auto está {safe_price(gap)} por encima del promedio del mercado "
                f"({safe_price(current_price)} vs promedio {safe_price(fmv['avg'])}). "
                f"Podemos presionar aquí con datos reales."
            )
        elif gap and gap < -PRICE_BELOW_MARKET:
            strengths.append(
                f"Precio {safe_price(abs(gap))} debajo del promedio del mercado "
                f"({safe_price(current_price)} vs {safe_price(fmv['avg'])}). "
                f"Oportunidad real — actuar rápido."
            )
        if fmv["low"] < current_price:
            strengths.append(
                f"Hay {fmv['total']:,} unidades similares activas. "
                f"El precio más bajo del mercado es {safe_price(fmv['low'])}. "
                f"Argumento sólido para negociar a la baja."
            )

    if days_on_market > 60:
        strengths.append(
            f"A más de 60 días en inventario, el dealer enfrenta costos de piso. "
            f"Una oferta directa y rápida tiene alta probabilidad de éxito."
        )

    # ── IMPRIMIR REPORTE ──────────────────────────────────────────

    W = 70

    def section(title: str) -> None:
        print(f"\n{'─' * W}")
        print(f"  {title}")
        print(f"{'─' * W}")

    print("\n" + "═" * W)
    print("  🧠  MOVITTY INTELLIGENCE REPORT")
    print(f"  VIN: {vin}")
    print(f"  Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("═" * W)

    # ── 1. FICHA TÉCNICA CONFIRMADA ──
    section("📋  FICHA TÉCNICA CONFIRMADA")

    if "_error" not in specs:
        fields = [
            ("Vehículo",      f"{specs.get('year','N/D')} {specs.get('make','N/D')} {specs.get('model','N/D')} {specs.get('trim','')}".strip()),
            ("Carrocería",    f"{specs.get('body_type','N/D')} · {specs.get('doors','N/D')} puertas"),
            ("Motor",         f"{specs.get('engine','N/D')} · {specs.get('cylinders','N/D')} cilindros"),
            ("Transmisión",   specs.get("transmission", "N/D")),
            ("Tracción",      specs.get("drivetrain", "N/D")),
            ("Combustible",   specs.get("fuel_type", "N/D")),
            ("Economía",      f"{specs.get('city_mpg','N/D')} ciudad / {specs.get('highway_mpg','N/D')} carretera (mpg)"),
            ("Capacidad",     f"{specs.get('std_seating','N/D')} pasajeros"),
            ("Fabricado en",  specs.get("made_in", "N/D")),
            ("Dimensiones",   f"L {specs.get('overall_length','?')}\" · W {specs.get('overall_width','?')}\" · H {specs.get('overall_height','?')}\""),
        ]
        col = max(len(k) for k, _ in fields) + 2
        for key, val in fields:
            print(f"    {(key + ':').ljust(col)} {val}")
    else:
        print(f"    ⚠️  No se pudieron obtener las especificaciones: {specs.get('_error')}")

    # ── 2. CRONOLOGÍA DE PRECIOS ──
    section("📈  CRONOLOGÍA DE PRECIOS")

    if timeline:
        for i, entry in enumerate(timeline):
            marker  = " ← PRECIO INICIAL" if i == 0 else (" ← PRECIO ACTUAL" if i == len(timeline) - 1 else "")
            if i == 0:
                arrow = "   "
            elif entry["delta"] < 0:
                arrow = "↓  "
            else:
                arrow = "↑  "
            delta_str = f"  ({safe_price(entry['delta'])})" if entry["delta"] != 0 else ""
            print(f"    {arrow} {entry['date']}   {safe_price(entry['price'])}{delta_str}{marker}")

        print()
        print(f"    Variación total:  {safe_price(total_drop) if total_drop < 0 else '+' + safe_price(total_drop)}")
        print(f"    Días en mercado:  {days_on_market} días  (desde {first_seen_date})")
        print(f"    Última actividad: {last_seen_date}")
    else:
        print("    Sin historial de precios registrado para este VIN.")

    # ── 3. FAIR MARKET VALUE ──
    section("⚖️   FAIR MARKET VALUE")

    if fmv:
        print(f"    Vehículos similares activos:  {fmv['total']:,} en el mercado nacional")
        print(f"    Muestra analizada:            {fmv['sample']} listings con precio")
        print()
        print(f"    {'Precio mínimo del mercado:'.ljust(34)} {safe_price(fmv['low'])}")
        print(f"    {'Precio promedio del mercado:'.ljust(34)} {safe_price(fmv['avg'])}")
        print(f"    {'Precio mediano del mercado:'.ljust(34)} {safe_price(fmv['median'])}")
        print(f"    {'Precio máximo del mercado:'.ljust(34)} {safe_price(fmv['high'])}")
        if current_price:
            gap = current_price - fmv["avg"]
            direction = "por encima" if gap > 0 else "por debajo"
            print()
            print(f"    ► Precio del vehículo objetivo: {safe_price(current_price)}")
            print(f"    ► Posición vs. mercado:         {safe_price(abs(gap))} {direction} del promedio")
    else:
        print("    No se pudo obtener comparativa de mercado.")

    # ── 4. FORTALEZAS DE NEGOCIACIÓN ──
    section("💪  FORTALEZAS DE NEGOCIACIÓN")

    if strengths:
        for s in strengths:
            print(f"    ✅  {s}\n")
    else:
        print("    Sin fortalezas de negociación identificadas.")

    # ── 5. DEBILIDADES DEL VENDEDOR ──
    section("🎯  DEBILIDADES DEL VENDEDOR")

    if weaknesses:
        for w in weaknesses:
            print(f"    🔴  {w}\n")
    else:
        print("    Sin señales de debilidad del vendedor detectadas.")

    # ── VEREDICTO FINAL ──
    section("📊  VEREDICTO MOVITTY")

    score = len(weaknesses) * 2 + len(strengths)
    if score >= 4:
        verdict = "🔥  MÁXIMA PRESIÓN — Todas las condiciones favorecen al comprador. Oferta agresiva justificada."
    elif score >= 2:
        verdict = "💡  BUENA OPORTUNIDAD — Hay argumentos sólidos. Negociar con confianza."
    else:
        verdict = "⚠️  MERCADO EQUILIBRADO — Poca presión sobre el vendedor. Negociar con información."

    print(f"\n    {verdict}\n")

    if dealer_name and dealer_name != "el dealer":
        print(f"    Dealer objetivo: {dealer_name}")
        if dealer_loc:
            print(f"    Ubicación:       {dealer_loc}")
    if vdp_url:
        print(f"    VDP:             {vdp_url}")

    print("\n" + "═" * W + "\n")


# ─── Entrada principal ────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 intelligence_report.py <VIN>")
        print("Ej:  python3 intelligence_report.py KL77LGEP4TC079564")
        sys.exit(1)

    vin = sys.argv[1].strip().upper()

    if len(vin) != 17:
        print(f"❌  VIN inválido: '{vin}'. Debe tener 17 caracteres.")
        sys.exit(1)

    print(f"\n⏳  Generando Movitty Intelligence Report para VIN: {vin}")
    print("    Consultando specs, historial y mercado activo...\n")

    specs   = fetch_specs(vin)

    if "_error" in specs:
        print(f"❌  VIN no encontrado en la base de datos de Marketcheck. ({specs['_error']})")
        sys.exit(1)

    history = fetch_history(vin)
    year    = specs.get("year",  "")
    make    = specs.get("make",  "")
    model   = specs.get("model", "")

    market_data = fetch_market(make, model, year) if make and model else {}

    print_report(vin, specs, history, market_data)


if __name__ == "__main__":
    main()
