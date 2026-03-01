"""
╔══════════════════════════════════════════════════════════════╗
║           MOVITTY — VIN History Analyzer                     ║
║           Powered by Marketcheck API                         ║
╚══════════════════════════════════════════════════════════════╝

Uso:
    python3 vin_history.py <VIN>

Ejemplo:
    python3 vin_history.py KL77LGEP4TC079564
"""

import sys
import json
import requests
from datetime import datetime, timezone

# ─── Configuración ─────────────────────────────────────────────
API_KEY   = "DmCy2HntmaaWGWWgApjMB0SlgSYP9Kd4"
BASE_URL  = "https://api.marketcheck.com/v2/history/car"

DAYS_ON_MARKET_THRESHOLD = 30       # días para considerar "Estancado"
PRICE_DROP_THRESHOLD     = 1_000    # dólares de caída para activar alerta


# ─── Helpers ────────────────────────────────────────────────────

def iso_to_date(iso_str) -> str:
    """Convierte un string ISO 8601 a fecha legible YYYY-MM-DD."""
    if not iso_str:
        return "N/D"
    try:
        return iso_str[:10]  # Toma solo YYYY-MM-DD
    except Exception:
        return str(iso_str)


def days_between_unix(ts_start, ts_end) -> int:
    """Calcula días entre dos timestamps Unix en segundos."""
    try:
        start = datetime.fromtimestamp(int(ts_start), tz=timezone.utc)
        end   = datetime.fromtimestamp(int(ts_end),   tz=timezone.utc)
        return (end - start).days
    except Exception:
        return 0


# ─── Fetch API ──────────────────────────────────────────────────

def fetch_vin_history(vin: str) -> dict:
    """Llama al endpoint de Marketcheck y devuelve el JSON crudo."""
    url    = f"{BASE_URL}/{vin}"
    params = {"api_key": API_KEY}

    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code in (404, 400):
            return {"error": "not_found"}
        return {"error": f"http_error: {e}"}
    except requests.exceptions.ConnectionError:
        return {"error": "connection_error"}
    except requests.exceptions.Timeout:
        return {"error": "timeout"}
    except Exception as e:
        return {"error": str(e)}


# ─── Procesamiento ──────────────────────────────────────────────

def extract_price_history(listings: list) -> list[dict]:
    """Extrae cambios de precio únicos en orden cronológico (más antiguo primero)."""
    # Las listings de la API vienen de más reciente a más antigua. Invertimos.
    sorted_listings = sorted(listings, key=lambda l: l.get("first_seen_at", 0))

    price_history = []
    seen_prices   = []

    for listing in sorted_listings:
        price = listing.get("price")
        # ISO date de la snapshot
        date = (iso_to_date(listing.get("first_seen_at_date"))
                or "N/D")

        if price is not None and price != 0:
            # Solo registra si el precio cambió respecto al anterior
            if not seen_prices or seen_prices[-1] != price:
                price_history.append({"date": date, "price": price})
                seen_prices.append(price)

    return price_history


def analyze(vin: str, data: dict) -> None:
    """Aplica la lógica de negocio Movitty y muestra el resumen."""

    # ── Manejo de errores de API ─────────────────────────────────
    if "error" in data:
        error_code = data["error"]
        if error_code == "not_found":
            print(f"\n❌  VIN no encontrado en la base de datos de Marketcheck.\n    VIN consultado: {vin}")
        elif error_code == "connection_error":
            print("\n⚠️  No se pudo conectar con Marketcheck API. Verifica tu conexión o la validez del endpoint.")
        elif error_code == "timeout":
            print("\n⚠️  La petición a Marketcheck tardó demasiado. Intenta de nuevo.")
        else:
            print(f"\n⚠️  Error inesperado: {error_code}")
        return

    listings = data if isinstance(data, list) else data.get("listings", [])

    # ── Sin historial ────────────────────────────────────────────
    if not listings:
        print(f"\n❌  VIN no encontrado en la base de datos de Marketcheck.\n    VIN consultado: {vin}")
        return

    # ── La API devuelve listings de más reciente a más antigua. Ordenamos. ───
    listings_sorted = sorted(listings, key=lambda l: l.get("first_seen_at", 0))

    # ── Extracción de fechas clave ───────────────────────────────
    # La API devuelve: first_seen_at (unix seg) + first_seen_at_date (ISO)
    first_seen_ts  = listings_sorted[0].get("first_seen_at")
    last_seen_ts   = listings_sorted[-1].get("last_seen_at") or listings_sorted[-1].get("first_seen_at")

    first_seen_str = iso_to_date(listings_sorted[0].get("first_seen_at_date"))
    last_seen_str  = iso_to_date(listings_sorted[-1].get("last_seen_at_date") or listings_sorted[-1].get("first_seen_at_date"))

    # ── Days on Market ───────────────────────────────────────────
    days_on_market = days_between_unix(first_seen_ts, last_seen_ts) if first_seen_ts and last_seen_ts else 0

    # ── Historial de precios ─────────────────────────────────────
    price_history = extract_price_history(listings)

    initial_price = price_history[0]["price"]  if price_history else None
    current_price = price_history[-1]["price"] if price_history else None

    total_price_change = (current_price - initial_price) if (initial_price and current_price) else 0

    # ── Estado del Inventario ────────────────────────────────────
    estado = "🔴 Estancado" if days_on_market > DAYS_ON_MARKET_THRESHOLD else "🟢 Fresco"

    # ── Alertas ──────────────────────────────────────────────────
    alertas = []
    if days_on_market > DAYS_ON_MARKET_THRESHOLD:
        alertas.append(f"⚠️  El vehículo lleva {days_on_market} días en inventario (límite: {DAYS_ON_MARKET_THRESHOLD} días).")
    if total_price_change < -PRICE_DROP_THRESHOLD:
        alertas.append(f"⚠️  Reducción de precio de ${abs(total_price_change):,.0f} desde su publicación inicial.")

    # ── Metadatos del vehículo ───────────────────────────────────
    # El endpoint /history no devuelve el campo 'build'.
    # Se infiere el vehículo desde el VDP URL (e.g. /2026-Chevrolet-Trax-...)
    import re
    sample     = listings_sorted[0]
    vdp_url    = sample.get("vdp_url", "")
    vehicle_id = "N/D"
    try:
        match = re.search(r'/(\d{4})-([A-Za-z]+)-([A-Za-z0-9]+)', vdp_url)
        if match:
            vehicle_id = f"{match.group(1)} {match.group(2)} {match.group(3)}"
    except Exception:
        pass

    # ─────────────────────────────────────────────────────────────
    # SALIDA ESTRUCTURADA — MOVITTY STYLE
    # ─────────────────────────────────────────────────────────────
    print("\n" + "═" * 60)
    print("  🚗  MOVITTY — Análisis de Historial de Vehículo")
    print("═" * 60)
    print(f"  VIN:        {vin}")
    print(f"  Vehículo:   {vehicle_id}")
    print("─" * 60)


    print(f"\n📅  Fecha de entrada al mercado:  {first_seen_str}")
    print(f"📅  Última actualización:          {last_seen_str}")
    print(f"⏱️   Days on Market:               {days_on_market} días")

    print(f"\n📦  Estado del Inventario:  {estado}")

    print("\n💰  Evolución de Precio:")
    if price_history:
        for i, entry in enumerate(price_history):
            marker = " ← inicial" if i == 0 else (" ← actual" if i == len(price_history) - 1 else "")
            arrow  = "  " if i == 0 else ("  ↓" if entry["price"] < price_history[i-1]["price"] else "  ↑")
            print(f"    {arrow}  {entry['date']}  →  ${entry['price']:,.0f}{marker}")

        if total_price_change != 0:
            direction = "bajó" if total_price_change < 0 else "subió"
            print(f"\n    Diferencia total: el precio {direction} ${abs(total_price_change):,.0f}")
    else:
        print("    Sin cambios de precio registrados.")

    print("\n🔔  Alerta para el Advisor:")
    if alertas:
        for alerta in alertas:
            print(f"    {alerta}")
    else:
        print("    ✅  Sin alertas. El vehículo está en condiciones normales de mercado.")

    print("\n" + "═" * 60)


# ─── Entrada principal ──────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        # Si no se pasa argumento, usa el VIN de ejemplo
        vin = "KL77LGEP4TC079564"
        print(f"ℹ️  Sin VIN especificado. Usando VIN de ejemplo: {vin}")
    else:
        vin = sys.argv[1].strip().upper()

    if len(vin) != 17:
        print(f"❌  El VIN '{vin}' no es válido. Debe tener exactamente 17 caracteres.")
        sys.exit(1)

    print(f"\n🔍  Consultando historial para VIN: {vin} ...")
    data = fetch_vin_history(vin)
    analyze(vin, data)


if __name__ == "__main__":
    main()
