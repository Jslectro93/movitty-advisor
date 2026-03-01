"""
╔══════════════════════════════════════════════════════════════╗
║        MOVITTY — Radar de Inventario                        ║
║        Powered by Marketcheck API                           ║
╚══════════════════════════════════════════════════════════════╝

Uso:
    python3 radar_inventario.py --year 2023 --make Toyota --model RAV4
    python3 radar_inventario.py --year 2023 --make Toyota --model RAV4 --color White
    python3 radar_inventario.py --year 2023 --make Toyota --model RAV4 --zip 75001 --radius 100

Todos los parámetros excepto --year, --make y --model son opcionales.
"""

import sys
import argparse
import requests
from datetime import datetime, timezone

# ─── Configuración ─────────────────────────────────────────────
API_KEY  = "DmCy2HntmaaWGWWgApjMB0SlgSYP9Kd4"
BASE_URL = "https://api.marketcheck.com/v2/search/car/active"

DOM_NEGOTIATION_THRESHOLD = 45   # días en mercado para marcar oportunidad


# ─── Fetch API ──────────────────────────────────────────────────

def fetch_listings(year: str, make: str, model: str,
                   color: str = None, zip_code: str = None,
                   radius: str = None, rows: int = 20) -> dict:
    """Llama al endpoint de búsqueda activa de Marketcheck."""
    params = {
        "api_key":    API_KEY,
        "year":       year,
        "make":       make,
        "model":      model,
        "rows":       rows,
        "start":      0,
        "price_min":  1,           # Excluye listings sin precio publicado
        "sort_by":    "dom",       # Ordena por días en mercado (oportunidades primero)
        "sort_order": "desc",
    }
    if color:
        params["exterior_color"] = color
    if zip_code:
        params["zip"] = zip_code
    if radius:
        params["radius"] = radius

    try:
        r = requests.get(BASE_URL, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        return {"error": f"http_{code}"}
    except requests.exceptions.ConnectionError:
        return {"error": "connection_error"}
    except requests.exceptions.Timeout:
        return {"error": "timeout"}
    except Exception as e:
        return {"error": str(e)}


# ─── Helpers ────────────────────────────────────────────────────

def safe_price(val) -> str:
    try:
        return f"${int(val):,}"
    except (TypeError, ValueError):
        return "N/D"


def safe_int(val, default=0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def opportunity_flags(listing: dict, avg_price: float) -> list[str]:
    """Devuelve lista de indicadores de oportunidad para este listing."""
    flags = []
    dom   = safe_int(listing.get("dom", listing.get("days_on_market")))
    price = safe_int(listing.get("price"))

    if dom > DOM_NEGOTIATION_THRESHOLD:
        flags.append(f"🔥 Alta posibilidad de negociación ({dom} días en mercado)")

    if avg_price and price and price < avg_price * 0.97:
        diff = int(avg_price - price)
        flags.append(f"💰 Precio competitivo (${diff:,} bajo el promedio del mercado)")

    return flags


# ─── Procesamiento y Visualización ──────────────────────────────

def print_radar(year, make, model, color, zip_code, radius, data: dict) -> None:

    # ── Manejo de errores ────────────────────────────────────────
    if "error" in data:
        err = data["error"]
        msgs = {
            "connection_error": "No se pudo conectar con Marketcheck API.",
            "timeout":          "La petición tardó demasiado. Intenta de nuevo.",
            "http_401":         "API Key inválida o expirada.",
            "http_429":         "Límite de peticiones alcanzado. Espera un momento.",
            "http_404":         "Endpoint no encontrado. Verifica la URL.",
        }
        print(f"\n⚠️  {msgs.get(err, f'Error inesperado: {err}')}")
        return

    listings = data.get("listings", [])
    total    = data.get("num_found", len(listings))

    if not listings:
        print(f"\n❌  No se encontraron resultados para {year} {make} {model}"
              + (f" · Color: {color}" if color else "")
              + (f" · ZIP: {zip_code}" if zip_code else "")
              + ".")
        return

    # ── Calcular precio promedio del conjunto ────────────────────
    prices    = [safe_int(l.get("price")) for l in listings if safe_int(l.get("price")) > 0]
    avg_price = sum(prices) / len(prices) if prices else 0

    # ── Encabezado ───────────────────────────────────────────────
    print("\n" + "═" * 78)
    print("  📡  MOVITTY — Radar de Inventario")
    print("═" * 78)

    criteria = f"  {year} {make} {model}"
    if color:
        criteria += f" · {color}"
    if zip_code:
        criteria += f" · ZIP {zip_code}"
        if radius:
            criteria += f" (+{radius} mi)"
    print(criteria)

    print(f"  Resultados: {len(listings)} de {total:,} encontrados   "
          f"  Precio promedio: {safe_price(int(avg_price)) if avg_price else 'N/D'}")
    print("═" * 78)

    # ── Tabla de resultados ──────────────────────────────────────
    for i, listing in enumerate(listings, start=1):
        build  = listing.get("build", {}) or {}
        yr     = build.get("year",  year)
        mk     = build.get("make",  make)
        md     = build.get("model", model)
        trim   = build.get("trim",  listing.get("trim", ""))
        color_ = listing.get("exterior_color", build.get("exterior_color", "N/D"))

        price   = listing.get("price")
        msrp    = listing.get("msrp")
        miles   = listing.get("miles", 0)
        dom     = safe_int(listing.get("dom", listing.get("days_on_market")))
        # La API devuelve dealer info en el objeto 'dealer'
        dealer_obj = listing.get("dealer") or listing.get("mc_dealership") or {}
        dealer  = dealer_obj.get("name", "N/D")
        city    = dealer_obj.get("city", "N/D")
        state   = dealer_obj.get("state", "")
        vdp     = listing.get("vdp_url", "N/D")

        flags = opportunity_flags(listing, avg_price)

        print(f"\n  [{i}]  {yr} {mk} {md} {trim}".rstrip())
        print(f"       Color: {color_}   |   Millas: {safe_int(miles):,}   |   DOM: {dom} días")
        print(f"       Precio: {safe_price(price)}   |   MSRP: {safe_price(msrp)}")
        print(f"       Dealer: {dealer} — {city}{', ' + state if state else ''}")
        print(f"       🔗 {vdp}")

        if flags:
            for flag in flags:
                print(f"       {flag}")

        print("  " + "─" * 74)

    print()
    print(f"  ℹ️   Promedio de mercado para esta búsqueda: {safe_price(int(avg_price)) if avg_price else 'N/D'}")
    print("═" * 78 + "\n")


# ─── Entrada principal ──────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Movitty — Radar de Inventario (Marketcheck Active Search)"
    )
    parser.add_argument("--year",   required=True,  help="Año del vehículo (ej: 2023)")
    parser.add_argument("--make",   required=True,  help="Marca (ej: Toyota)")
    parser.add_argument("--model",  required=True,  help="Modelo (ej: RAV4)")
    parser.add_argument("--color",  default=None,   help="Color exterior (ej: White)")
    parser.add_argument("--zip",    default=None,   help="Código postal (ej: 75001)")
    parser.add_argument("--radius", default=None,   help="Radio en millas (ej: 100)")
    parser.add_argument("--rows",   default=10, type=int, help="Número de resultados (default: 10)")
    return parser.parse_args()


def main():
    args = parse_args()

    print(f"\n📡  Buscando: {args.year} {args.make} {args.model}"
          + (f" · {args.color}" if args.color else "")
          + (f" · ZIP {args.zip}" if args.zip else "")
          + " ...")

    data = fetch_listings(
        year=args.year, make=args.make, model=args.model,
        color=args.color, zip_code=args.zip, radius=args.radius,
        rows=args.rows
    )

    print_radar(args.year, args.make, args.model,
                args.color, args.zip, args.radius, data)


if __name__ == "__main__":
    main()
