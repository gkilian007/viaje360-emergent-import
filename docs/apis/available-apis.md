# Public APIs — Reference for Viaje360 & Future Apps

_Source: [public-apis/public-apis](https://github.com/public-apis/public-apis) (432k ★)_
_Clone: `knowledge/public-apis/` (full README 198KB)_
_Last updated: 2026-05-06_

---

## 🔴 Essential for Viaje360 (free, no auth or generous free tier)

### Geocoding / Maps

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **OpenStreetMap Nominatim** | No | Yes | Yes | Geocoding + reverse geocoding — already in Viaje360 |
| **Overpass API** | No | Yes | Yes | POI queries (restaurants, monuments, transport stops) |
| **REST Countries** | No | Yes | Yes | Country info for destination cards |
| **GeoDB Cities** | apiKey | Yes | Yes | Cities, population, coordinates, timezone |
| **OpenStreetMap Tile** | No | Yes | Yes | Map tiles — already in Viaje360 via Leaflet |

### Weather

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Open-Meteo** | No | Yes | Yes | Free weather + forecast, no auth needed — **best pick** |
| **OpenWeatherMap** | apiKey | Yes | Yes | Current + forecast + historical — free tier 60/min |
| **Weatherstack** | apiKey | Yes | Unknown | Current + historical weather |
| **Meteostat** | apiKey | Yes | Unknown | Historical weather + climate data |

### Currency Exchange

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Frankfurter** | No | Yes | Yes | ECB exchange rates — no auth, no limits |
| **Currency-api** | No | Yes | Yes | 150+ currencies, no rate limits |
| **ExchangeRate-API** | apiKey | Yes | Yes | Free tier 1500 requests/month |
| **VATComply.com** | No | Yes | Yes | Exchange rates + geolocation + VAT validation |
| **Exchangerate.host** | No | Yes | Unknown | Free forex + crypto rates |

### Transportation

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Aviationstack** | apiKey | Yes | Unknown | Real-time flight status |
| **TransitLand** | No | Yes | Unknown | Public transport routes/stops worldwide |
| **Navitia** | apiKey | Yes | Unknown | European public transport routing |
| **Transport for London** | apiKey | Yes | Unknown | London transit — model for city integrations |
| **Schiphol Airport** | apiKey | Yes | Unknown | Flight data from Amsterdam hub |

---

## 🟡 Useful for Viaje360 (requires API key, good free tier)

### Events / Activities

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Ticketmaster** | apiKey | Yes | Unknown | Events at destinations |
| **SeatGeek** | apiKey | Yes | Unknown | Events, venues, performers |
| **Eventbrite** | OAuth | Yes | Unknown | Local events search |

### Food & Restaurants

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Open Food Facts** | No | Yes | Unknown | Food product database |
| **Open Brewery DB** | No | Yes | Yes | Breweries by location |
| **Spoonacular** | apiKey | Yes | Unknown | Recipes + meal planning — for food guides |
| **Edamam recipes** | apiKey | Yes | Unknown | Recipe search |
| **Zomato** | apiKey | Yes | Unknown | Restaurants by location (limited markets) |

### News / Safety

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **GNews** | apiKey | Yes | Yes | News by country/topic — destination alerts |
| **NewsAPI** | apiKey | Yes | Unknown | News by source/country |
| **Currents API** | apiKey | Yes | Unknown | Multilingual news |

### Photography / Images

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Unsplash** | OAuth | Yes | Yes | High-quality destination photos |
| **Pexels** | apiKey | Yes | Yes | Photos + videos of destinations |
| **Pixabay** | apiKey | Yes | Yes | Free stock images |

### Environment (air quality, pollen)

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **OpenAQ** | apiKey | Yes | Unknown | Open air quality data |
| **IQAir** | apiKey | Yes | Unknown | Air quality + weather |
| **BreezoMeter Pollen** | apiKey | Yes | Unknown | Pollen forecasts by location |

---

## 🟢 Nice-to-have / Future apps

### Music (MelodyForMe)

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **MusicBrainz** | No | Yes | Unknown | Music metadata — disc, year, genre |
| **Genius** | OAuth | Yes | Yes | Song lyrics reference |
| **AudD** | apiKey | Yes | Unknown | Audio recognition |

### Open Data / Government

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **Wikipedia API** | No | Yes | Unknown | Destination content |
| **Wikidata** | No | Yes | Unknown | Structured place data |
| **World Bank** | No | Yes | Unknown | Country statistics |
| **Numbeo** | No | Yes | Unknown | Cost of living by city |

### Science & Math

| API | Auth | HTTPS | CORS | Use case |
|-----|------|-------|------|----------|
| **USGS Earthquake Hazards** | No | Yes | Yes | Seismic data for travel safety |
| **EPA** | No | Yes | Unknown | Environmental data |

---

## Quick integration priority for Viaje360

**Phase 1 — No auth, drop-in ready:**
1. **Open-Meteo** → weather for any destination (no key needed)
2. **Frankfurter** → currency conversion for travelers (no key needed)
3. **REST Countries** → country info cards (no key needed)
4. **Overpass API** → POI enrichment (no key needed)

**Phase 2 — Free tier with API key:**
5. **OpenWeatherMap** → extended forecast + alerts
6. **GeoDB Cities** → city search + autocomplete
7. **Aviationstack** → flight status

**Phase 3 — Enrichment:**
8. **Ticketmaster / SeatGeek** → events at destination
9. **Unsplash / Pexels** → destination imagery
10. **GNews** → destination news alerts

---

## Full catalog

The complete 198KB README with 1400+ APIs is at:
`knowledge/public-apis/README.md`

Browse by category index (50+ categories).
