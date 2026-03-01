"""
╔══════════════════════════════════════════════════════════════╗
║       MOVITTY — Smart Search (Búsqueda Natural)             ║
║       El Advisor escribe como habla                         ║
╚══════════════════════════════════════════════════════════════╝

Interpreta una descripción en lenguaje natural y ejecuta el
Movitty Intelligence Report automáticamente.

Uso:
    python3 smart_search.py "corolla blanco 2025 en boca raton"
    python3 smart_search.py "rav4 negro 2023 cerca de miami"
    python3 smart_search.py "camry gris 2024 en orlando fl"
"""

import sys
import re
import requests
from datetime import datetime, timezone

# ─── Configuración ────────────────────────────────────────────────
API_KEY  = "DmCy2HntmaaWGWWgApjMB0SlgSYP9Kd4"
BASE_URL = "https://api.marketcheck.com/v2"

DOM_WEAK_SELLER_DAYS = 30
PRICE_ABOVE_MARKET   = 500
PRICE_BELOW_MARKET   = 500
AGGRESSIVE_DROP      = 800
DEFAULT_RADIUS       = 100   # millas


# ─────────────────────────────────────────────────────────────────
# 1.  DICCIONARIOS PARA EL PARSER
# ─────────────────────────────────────────────────────────────────

COLORS_ES_EN = {
    # Español → English (como espera Marketcheck)
    "blanco":   "White",
    "negro":    "Black",
    "rojo":     "Red",
    "azul":     "Blue",
    "gris":     "Gray",
    "plateado": "Silver",
    "plata":    "Silver",
    "verde":    "Green",
    "amarillo": "Yellow",
    "naranja":  "Orange",
    "cafe":     "Brown",
    "café":     "Brown",
    "marron":   "Brown",
    "marrón":   "Brown",
    "beige":    "Beige",
    "dorado":   "Gold",
    "morado":   "Purple",
    "violeta":  "Purple",
    "blanca":   "White",
    "negra":    "Black",
    "roja":     "Red",
    "azul marino": "Blue",
    # Inglés passthrough
    "white":    "White",
    "black":    "Black",
    "red":      "Red",
    "blue":     "Blue",
    "gray":     "Gray",
    "grey":     "Gray",
    "silver":   "Silver",
    "green":    "Green",
}

# Make → [modelos conocidos]  — para mejorar la detección
MAKE_MODELS = {
    "Toyota":     ["corolla","camry","rav4","highlander","tacoma","tundra","4runner","sienna","prius","yaris","venza","sequoia","avalon","chr","c-hr"],
    "Honda":      ["civic","accord","crv","cr-v","hrv","hr-v","pilot","odyssey","ridgeline","passport","fit","insight"],
    "Chevrolet":  ["silverado","malibu","equinox","traverse","tahoe","suburban","trax","blazer","trailblazer","camaro","corvette","impala","spark","sonic"],
    "Ford":       ["f-150","f150","f-250","mustang","explorer","escape","edge","bronco","ranger","expedition","fusion","maverick","transit"],
    "Nissan":     ["altima","sentra","maxima","rogue","murano","pathfinder","armada","frontier","titan","versa","kicks","leaf","qashqai"],
    "Hyundai":    ["elantra","sonata","tucson","santa fe","palisade","kona","venue","ioniq","accent","nexo"],
    "Kia":        ["optima","k5","sorento","sportage","forte","rio","soul","telluride","carnival","stinger","ev6","niro"],
    "Jeep":       ["wrangler","cherokee","grand cherokee","compass","renegade","gladiator","commander","patriot"],
    "BMW":        ["3 series","5 series","7 series","x3","x5","x1","x7","m3","m5","i4","ix"],
    "Mercedes":   ["c-class","e-class","s-class","glc","gle","gla","gls","cla","a-class","amg"],
    "Audi":       ["a3","a4","a6","a8","q3","q5","q7","q8","e-tron","tt","r8"],
    "Volkswagen": ["jetta","passat","golf","tiguan","atlas","taos","arteon","id4"],
    "Subaru":     ["outback","forester","crosstrek","impreza","legacy","ascent","wrx","brz","solterra"],
    "Mazda":      ["mazda3","mazda6","cx-5","cx-9","cx-30","cx-50","mx-5","miata"],
    "Dodge":      ["charger","challenger","durango","ram","journey","dart","viper","hornet"],
    "Ram":        ["1500","2500","3500","promaster"],
    "GMC":        ["sierra","canyon","terrain","acadia","yukon","envoy","savana"],
    "Lexus":      ["es","is","gs","ls","ux","nx","rx","gx","lx","rc","lc"],
    "Cadillac":   ["escalade","ct4","ct5","xt4","xt5","xt6","lyriq"],
    "Volvo":      ["xc40","xc60","xc90","s60","s90","v60","v90","c40"],
    "Acura":      ["mdx","rdx","tlx","integra","nsx","ilx","tsx"],
    "Infiniti":   ["q50","q60","qx50","qx60","qx80","fx"],
    "Lincoln":    ["navigator","aviator","nautilus","corsair","mkz"],
    "Buick":      ["enclave","encore","envision","lacrosse","regal"],
    "Chrysler":   ["300","pacifica","voyager","aspen"],
    "Tesla":      ["model 3","model y","model s","model x","cybertruck"],
    "Genesis":    ["g70","g80","g90","gv70","gv80"],
    "Mitsubishi": ["outlander","eclipse cross","mirage","galant","lancer"],
    "Alfa Romeo": ["giulia","stelvio","tonale","4c"],
    "Porsche":    ["911","cayenne","macan","panamera","taycan","718"],
    "Land Rover": ["range rover","discovery","defender","freelander"],
    "Mini":       ["cooper","countryman","paceman","clubman","convertible"],
    "Fiat":       ["500","500x","500l","124 spider"],
}

# Índice invertido modelo → make
MODEL_TO_MAKE = {}
for make, models in MAKE_MODELS.items():
    for m in models:
        MODEL_TO_MAKE[m] = make

# Stopwords a ignorar en el parsing
STOPWORDS = {
    "en","cerca","de","o","el","la","los","las","un","una","año",
    "color","auto","carro","vehiculo","vehículo","nuevo","usado",
    "busco","quiero","necesito","dame","trae","y","con","para",
    "fl","tx","ca","ny","nj","ga","nc","sc","az","co","wa","or","il",
    "florida","texas","california","georgia",
}


# ─────────────────────────────────────────────────────────────────
# 2.  PARSER DE LENGUAJE NATURAL
# ─────────────────────────────────────────────────────────────────

def parse_query(raw: str) -> dict:
    """
    Extrae año, make, modelo, color y ciudad/estado del texto libre.
    Devuelve un dict con las claves encontradas.
    """
    text  = raw.lower().strip()
    found = {}

    # — Año —
    year_match = re.search(r'\b(19[89]\d|20[012]\d)\b', text)
    if year_match:
        found["year"] = year_match.group(1)
        text = text.replace(year_match.group(1), " ")

    # — Color —
    # Ordenamos por longitud desc para matchear "azul marino" antes de "azul"
    for es_color in sorted(COLORS_ES_EN, key=len, reverse=True):
        if es_color in text:
            found["color"] = COLORS_ES_EN[es_color]
            text = text.replace(es_color, " ")
            break

    # — Ubicación: extrae lo que está después de "en" / "cerca de" / "cerca" —
    loc_match = re.search(r'\b(?:en|cerca\s+de|cerca)\s+(.+?)(?:\s+o\s+cerca.*)?$', text)
    if loc_match:
        location_raw = loc_match.group(1).strip().rstrip(" o")
        # Limpiar stopwords de la ubicación
        loc_words = [w for w in location_raw.split() if w not in ("o","cerca","de","el","la")]
        found["location_raw"] = " ".join(loc_words)
        # Quitar la parte de ubicación del texto principal
        text = text[: loc_match.start()]

    # — Make / Modelo —
    # Busca coincidencias en el índice inverso MODEL_TO_MAKE
    remaining_words = [w for w in text.split() if w not in STOPWORDS and len(w) > 1]
    remaining_text  = " ".join(remaining_words)

    # Intentar modelos de 2 palabras primero (ej: "grand cherokee")
    matched_model = None
    for m_key in sorted(MODEL_TO_MAKE.keys(), key=len, reverse=True):
        if m_key in remaining_text:
            matched_model = m_key
            found["make"]  = MODEL_TO_MAKE[m_key]
            # Capitalizar correctamente el modelo
            found["model"] = m_key.title().replace("-", "-")
            remaining_text = remaining_text.replace(m_key, "")
            break

    # Si no se encontró modelo, los tokens restantes podrían ser make o modelo libre
    if not matched_model:
        leftover = [w for w in remaining_text.split() if w]
        if leftover:
            # Primer token podría ser el make o modelo — lo usamos como modelo libre
            found["model_free"] = " ".join(leftover).title()

    return found


# ─────────────────────────────────────────────────────────────────
# 3.  RESOLVER DE UBICACIÓN → ZIP CODE
# ─────────────────────────────────────────────────────────────────

def resolve_location(location_raw: str) -> dict | None:
    """
    Convierte una ciudad en un ZIP code.
    1. Nominatim (OpenStreetMap) con countrycodes=us
    2. Fallback: Zippopotam.us con los estados más comunes
    Devuelve {"zip": ..., "city": ..., "state": ...} o None.
    """
    if not location_raw:
        return None

    city_clean = location_raw.strip()

    # ── Intento 1: Nominatim ─────────────────────────────────────
    for query in [f"{city_clean}, USA", city_clean]:
        try:
            r = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json",
                        "addressdetails": 1, "limit": 1,
                        "countrycodes": "us"},
                headers={"User-Agent": "MovittyRadar/1.0"},
                timeout=8,
            )
            r.raise_for_status()
            results = r.json()
            if results:
                addr     = results[0].get("address", {})
                zip_code = addr.get("postcode", "").replace(" ", "")[:5]
                city     = (addr.get("city") or addr.get("town")
                            or addr.get("village") or city_clean.title())
                state    = addr.get("state", "")
                if zip_code and zip_code.isdigit() and len(zip_code) == 5:
                    return {"zip": zip_code, "city": city, "state": state}
        except Exception:
            continue

    # ── Intento 2: Zippopotam con estados más comunes ────────────
    # Formato: GET /us/{state_abbr}/{city name con espacios}
    TOP_STATES = ["fl","tx","ca","ny","nj","ga","nc","az","co","wa","il",
                  "oh","pa","mi","va","tn","sc","md","mn","mo","wi","ct"]
    for state_abbr in TOP_STATES:
        try:
            r = requests.get(
                f"https://api.zippopotam.us/us/{state_abbr}/{city_clean}",
                timeout=6,
            )
            if r.status_code == 200:
                data  = r.json()
                place = data.get("places", [{}])[0]
                zip_code = str(place.get("post code", ""))[:5]
                city_out = place.get("place name", city_clean.title())
                state_out = data.get("state", state_abbr.upper())
                if zip_code:
                    return {"zip": zip_code, "city": city_out, "state": state_out}
        except Exception:
            continue

    return None



# ─────────────────────────────────────────────────────────────────
# 4.  HELPERS (reutilizados de intelligence_report)
# ─────────────────────────────────────────────────────────────────

def api_get(path: str, params: dict = None) -> dict:
    url    = f"{BASE_URL}/{path}"
    params = {**(params or {}), "api_key": API_KEY}
    try:
        r = requests.get(url, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        return {"_error": f"HTTP {e.response.status_code if e.response else '?'}"}
    except Exception as e:
        return {"_error": str(e)}


def safe_int(v, d=0):
    try: return int(v)
    except: return d

def safe_price(v):
    try: return f"${int(v):,}"
    except: return "N/D"

def iso_date(s): return s[:10] if s else "N/D"

def days_since(ts):
    try:
        t = datetime.fromtimestamp(int(ts), tz=timezone.utc)
        return (datetime.now(tz=timezone.utc) - t).days
    except: return 0


# ─────────────────────────────────────────────────────────────────
# 5.  FETCH & ANÁLISIS
# ─────────────────────────────────────────────────────────────────

def fetch_market(make, model, year, color=None, zip_code=None, radius=None):
    params = {
        "make": make, "model": model, "year": str(year),
        "price_min": 1, "rows": 50,
        "sort_by": "dom", "sort_order": "desc",
    }
    if color:    params["exterior_color"] = color
    if zip_code: params["zip"] = zip_code
    if radius:   params["radius"] = radius
    return api_get("search/car/active", params)


def calc_fmv(listings):
    prices = [safe_int(l.get("price")) for l in listings if safe_int(l.get("price")) > 0]
    if not prices: return None
    prices.sort()
    return {"avg": int(sum(prices)/len(prices)), "low": prices[0],
            "high": prices[-1], "median": prices[len(prices)//2], "n": len(prices)}


# ─────────────────────────────────────────────────────────────────
# 6.  REPORTE DE RESULTADOS
# ─────────────────────────────────────────────────────────────────

def print_smart_report(parsed: dict, location: dict | None, data: dict) -> None:

    W = 72
    listings = data.get("listings", [])
    total    = data.get("num_found", 0)

    def section(t): print(f"\n{'─'*W}\n  {t}\n{'─'*W}")

    # ── Header ──
    print("\n" + "═"*W)
    print("  🧠  MOVITTY — Smart Search Report")
    print(f"  Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("═"*W)

    # ── Interpretación ──
    section("🔍  CONSULTA INTERPRETADA")
    print(f"    Año:       {parsed.get('year', 'Cualquiera')}")
    print(f"    Marca:     {parsed.get('make', parsed.get('model_free', 'N/D'))}")
    print(f"    Modelo:    {parsed.get('model', parsed.get('model_free', 'N/D'))}")
    print(f"    Color:     {parsed.get('color', 'Cualquiera')}")
    if location:
        print(f"    Zona:      {location['city']}, {location['state']}  (ZIP {location['zip']}, ±{DEFAULT_RADIUS} mi)")
    elif parsed.get("location_raw"):
        print(f"    Zona:      '{parsed['location_raw']}'  ← no se pudo resolver el ZIP")
    else:
        print(f"    Zona:      Nacional (sin filtro geográfico)")

    if not listings:
        print(f"\n  ❌  Sin resultados. Intenta ampliar los criterios.")
        print("═"*W + "\n")
        return

    fmv = calc_fmv(listings)

    # ── Fair Market Value ──
    section("⚖️   FAIR MARKET VALUE")
    print(f"    Resultados encontrados:   {total:,}  (mostrando los {len(listings)} más relevantes)")
    if fmv:
        print(f"\n    Precio mínimo:    {safe_price(fmv['low'])}")
        print(f"    Precio promedio:  {safe_price(fmv['avg'])}")
        print(f"    Precio mediano:   {safe_price(fmv['median'])}")
        print(f"    Precio máximo:    {safe_price(fmv['high'])}")

    # ── Tabla de listings ──
    section("🚗  INVENTARIO DISPONIBLE  (ordenado: más días en mercado primero)")

    for i, lst in enumerate(listings[:15], start=1):
        build   = lst.get("build", {}) or {}
        yr      = build.get("year",  parsed.get("year",""))
        mk      = build.get("make",  parsed.get("make",""))
        md      = build.get("model", parsed.get("model",""))
        trim    = build.get("trim",  "")
        color_  = lst.get("exterior_color", "N/D")
        price   = safe_int(lst.get("price"))
        msrp    = safe_int(lst.get("msrp"))
        miles   = safe_int(lst.get("miles"))
        dom     = safe_int(lst.get("dom"))
        dealer_ = (lst.get("dealer") or lst.get("mc_dealership") or {})
        dealer  = dealer_.get("name", "N/D")
        city_d  = dealer_.get("city", "")
        state_d = dealer_.get("state", "")
        vdp     = lst.get("vdp_url", "")

        # Indicadores de oportunidad
        flags = []
        if dom > DOM_WEAK_SELLER_DAYS:
            flags.append(f"🔥 {dom} días en mercado — negociable")
        if fmv and price and price < fmv["avg"] * 0.97:
            diff = fmv["avg"] - price
            flags.append(f"💰 {safe_price(diff)} bajo el promedio")
        if fmv and price and price > fmv["avg"] * 1.03:
            diff = price - fmv["avg"]
            flags.append(f"⚠️  {safe_price(diff)} sobre el promedio")

        print(f"\n  [{i:>2}]  {yr} {mk} {md} {trim}".rstrip())
        print(f"        Color: {color_:<10}  Millas: {miles:>7,}  DOM: {dom} días")
        print(f"        Precio: {safe_price(price):<12}  MSRP: {safe_price(msrp)}")
        print(f"        Dealer: {dealer} — {city_d}, {state_d}")
        if vdp:
            print(f"        🔗 {vdp}")
        for f in flags:
            print(f"        {f}")
        print(f"  {'·'*68}")

    # ── Veredicto ──
    section("📊  RESUMEN PARA EL ADVISOR")

    if fmv:
        best = min(listings, key=lambda l: safe_int(l.get("price")) or 999999)
        best_build  = best.get("build", {}) or {}
        best_price  = safe_int(best.get("price"))
        best_dom    = safe_int(best.get("dom"))
        best_dealer = ((best.get("dealer") or {}).get("name", ""))
        best_city   = ((best.get("dealer") or {}).get("city", ""))
        best_state  = ((best.get("dealer") or {}).get("state", ""))
        best_vdp    = best.get("vdp_url", "")

        print(f"\n    La mejor opción de precio: {safe_price(best_price)}")
        if best_dealer:
            print(f"    Dealer:                    {best_dealer} — {best_city}, {best_state}")
        if best_vdp:
            print(f"    Link:                      {best_vdp}")

        stagnant = [l for l in listings if safe_int(l.get("dom")) > DOM_WEAK_SELLER_DAYS]
        if stagnant:
            print(f"\n    {len(stagnant)} unidades llevan más de {DOM_WEAK_SELLER_DAYS} días en inventario.")
            print(f"    Estos dealers tienen presión de rotación — negociación más fácil.")

        below_avg = [l for l in listings if fmv and safe_int(l.get("price")) and safe_int(l.get("price")) < fmv["avg"] * 0.97]
        if below_avg:
            print(f"\n    {len(below_avg)} unidades están por debajo del promedio del mercado.")
            print(f"    Rango: {safe_price(min(safe_int(l.get('price')) for l in below_avg))} — {safe_price(max(safe_int(l.get('price')) for l in below_avg))}")

    print("\n" + "═"*W + "\n")


# ─────────────────────────────────────────────────────────────────
# 7.  ENTRADA PRINCIPAL
# ─────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Uso:  python3 smart_search.py \"corolla blanco 2025 en boca raton\"")
        sys.exit(1)

    raw_query = " ".join(sys.argv[1:])
    print(f"\n🔎  Procesando: \"{raw_query}\"")

    # 1. Parsear la query
    parsed = parse_query(raw_query)

    make  = parsed.get("make")
    model = parsed.get("model") or parsed.get("model_free")
    year  = parsed.get("year")
    color = parsed.get("color")

    if not model:
        print("❌  No pude identificar el modelo del vehículo en tu búsqueda.")
        print("    Intenta: \"corolla blanco 2025 en miami\"")
        sys.exit(1)

    # 2. Resolver ubicación → ZIP
    location = None
    zip_code = None
    if parsed.get("location_raw"):
        print(f"📍  Buscando ZIP para: \"{parsed['location_raw']}\"...")
        location = resolve_location(parsed["location_raw"])
        if location:
            zip_code = location["zip"]
            print(f"    ✅  {location['city']}, {location['state']}  →  ZIP {zip_code}")
        else:
            print(f"    ⚠️  No se encontró ubicación. Buscando a nivel nacional.")

    # 3. Buscar en el mercado
    print(f"📡  Consultando mercado activo...")
    data = fetch_market(
        make=make or model,
        model=model,
        year=year or "",
        color=color,
        zip_code=zip_code,
        radius=str(DEFAULT_RADIUS) if zip_code else None,
    )

    # 4. Mostrar reporte
    print_smart_report(parsed, location, data)


if __name__ == "__main__":
    main()
