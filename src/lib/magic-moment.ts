/**
 * Magic Moment Engine — detects serendipitous nearby POIs during the trip.
 *
 * Strategy: we maintain a curated static database of "magical" POIs per city
 * (hidden gems, perfect for spontaneous stops). When the user is between activities
 * with enough time, we surface the best match considering:
 *   - Distance from current position (< 600m default)
 *   - Matches user interests
 *   - Time fits in the gap before next activity
 *   - Currently open
 *   - Not too far into the day (user isn't exhausted)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearbyPOI {
  name: string
  type: string
  distanceMeters: number
  lat: number
  lng: number
  openNow: boolean
  /** Typical visit duration in minutes */
  durationMinutes: number
  mapsUrl: string
  description?: string
  emoji?: string
}

export interface MagicMomentContext {
  currentLat: number
  currentLng: number
  nextActivity: { name: string; lat?: number; lng?: number; time: string }
  minutesToNext: number
  userInterests: string[]
  /** 0 = start of day, 1 = end of day */
  dayProgress: number
  destination: string
}

export interface MagicMomentSuggestion {
  poi: NearbyPOI
  reason: string
  score: number
}

// ─── POI database ─────────────────────────────────────────────────────────────

interface CuratedPOI {
  name: string
  type: string
  lat: number
  lng: number
  durationMinutes: number
  description: string
  emoji: string
  /** Opening hours (simplified: hour of day range) */
  openFrom: number
  openUntil: number
}

const POI_DATABASE: Record<string, CuratedPOI[]> = {
  barcelona: [
    { name: "Mercat de la Boqueria", type: "gastronomia", lat: 41.3818, lng: 2.1720, durationMinutes: 30, description: "El mercado más famoso de Barcelona con fruta fresca, jamón y tapas", emoji: "🍓", openFrom: 8, openUntil: 20 },
    { name: "Granja M. Viader", type: "gastronomia", lat: 41.3825, lng: 2.1695, durationMinutes: 20, description: "Granja histórica de 1870, inventores del Cacaolat. Xocolata a la tassa increíble", emoji: "☕", openFrom: 9, openUntil: 21 },
    { name: "Palau de la Virreina", type: "arte", lat: 41.3820, lng: 2.1715, durationMinutes: 25, description: "Exposiciones de fotografía y artes visuales. Entrada gratuita frecuentemente", emoji: "🖼️", openFrom: 11, openUntil: 20 },
    { name: "Plaça de la Vila de Gràcia", type: "cultural", lat: 41.3986, lng: 2.1563, durationMinutes: 15, description: "La plaza del barrio de Gràcia con campanario y terrazas animadas", emoji: "🌿", openFrom: 0, openUntil: 24 },
    { name: "Bunkers del Carmel", type: "fotografia", lat: 41.4182, lng: 2.1523, durationMinutes: 45, description: "Antiguas baterías antiaéreas con la mejor panorámica de Barcelona", emoji: "🌆", openFrom: 0, openUntil: 24 },
    { name: "Bar Calders", type: "nocturna", lat: 41.3740, lng: 2.1606, durationMinutes: 20, description: "Bar de vermut con terrazas en el barrio del Poble Sec. Ambiente local", emoji: "🍷", openFrom: 10, openUntil: 24 },
    { name: "Jardins de Laribal", type: "naturaleza", lat: 41.3676, lng: 2.1567, durationMinutes: 30, description: "Jardines escalonados secretos en Montjuïc con fuentes y pérgolas", emoji: "🌸", openFrom: 10, openUntil: 20 },
    { name: "El Xampanyet", type: "gastronomia", lat: 41.3844, lng: 2.1806, durationMinutes: 20, description: "Bar de cava y tapas desde 1929 en el Born. Montaditos legendarios", emoji: "🥂", openFrom: 12, openUntil: 23 },
    { name: "Muelle de la Barceloneta", type: "playa", lat: 41.3769, lng: 2.1918, durationMinutes: 20, description: "Paseo marítimo con vistas al mar y ambiente relajado", emoji: "⛵", openFrom: 0, openUntil: 24 },
    { name: "Librería El Ateneu", type: "cultural", lat: 41.3821, lng: 2.1726, durationMinutes: 15, description: "Librería de vieja colección en el Raval. Libros de segunda mano y rarezas", emoji: "📚", openFrom: 10, openUntil: 20 },
  ],
  madrid: [
    { name: "Mercado de San Miguel", type: "gastronomia", lat: 40.4152, lng: -3.7091, durationMinutes: 30, description: "Mercado gastronómico premium junto a Plaza Mayor. Tapas y vinos", emoji: "🥘", openFrom: 10, openUntil: 24 },
    { name: "Jardín del Príncipe de Anglona", type: "naturaleza", lat: 40.4131, lng: -3.7133, durationMinutes: 20, description: "Jardín secreto escondido en La Latina. Pocos turistas lo conocen", emoji: "🌳", openFrom: 9, openUntil: 21 },
    { name: "Taberna Antonio Sánchez", type: "gastronomia", lat: 40.4133, lng: -3.7086, durationMinutes: 25, description: "La taberna más antigua de Madrid (1830). Ambiente taurino y cocido madrileño", emoji: "🍷", openFrom: 12, openUntil: 23 },
    { name: "Palacio de Cristal del Retiro", type: "arte", lat: 40.4134, lng: -3.6867, durationMinutes: 30, description: "Palacio de cristal y hierro con exposiciones del Reina Sofía. Entrada gratuita", emoji: "🏛️", openFrom: 10, openUntil: 19 },
    { name: "Calle de los Cuchilleros", type: "historia", lat: 40.4150, lng: -3.7088, durationMinutes: 15, description: "Calle medieval bajo los soportales de la Plaza Mayor. Mesones históricos", emoji: "🏰", openFrom: 0, openUntil: 24 },
    { name: "Café Comercial", type: "cultural", lat: 40.4247, lng: -3.7003, durationMinutes: 20, description: "El café más antiguo de Madrid (1887) en Bilbao. Tertulia y prensa", emoji: "☕", openFrom: 8, openUntil: 24 },
  ],
  paris: [
    { name: "Marché d'Aligre", type: "gastronomia", lat: 48.8500, lng: 2.3731, durationMinutes: 30, description: "El mercado más auténtico de París. Menos turístico que Bastille. Precio local", emoji: "🥐", openFrom: 7, openUntil: 13 },
    { name: "Promenade Plantée", type: "naturaleza", lat: 48.8487, lng: 2.3834, durationMinutes: 30, description: "Jardín elevado sobre una línea de tren abandonada. El High Line parisino", emoji: "🌿", openFrom: 8, openUntil: 21 },
    { name: "Sainte-Chapelle", type: "historia", lat: 48.8554, lng: 2.3450, durationMinutes: 30, description: "Capilla gótica con las vidrieras medievales más impresionantes del mundo", emoji: "🌈", openFrom: 9, openUntil: 17 },
    { name: "Square du Vert-Galant", type: "naturaleza", lat: 48.8575, lng: 2.3411, durationMinutes: 20, description: "Jardín en la punta de la Île de la Cité. Vista al Sena sin turistas", emoji: "🌊", openFrom: 0, openUntil: 24 },
    { name: "Rue Crémieux", type: "fotografia", lat: 48.8467, lng: 2.3667, durationMinutes: 15, description: "La calle más colorida de París. Cada casa pintada de un color diferente", emoji: "🎨", openFrom: 0, openUntil: 24 },
  ],
  rome: [
    { name: "Campo de' Fiori", type: "gastronomia", lat: 41.8955, lng: 12.4723, durationMinutes: 25, description: "Mercado matutino y plaza animada. Flores, verduras y aperitivo local", emoji: "🌺", openFrom: 7, openUntil: 14 },
    { name: "Trastevere", type: "cultural", lat: 41.8896, lng: 12.4699, durationMinutes: 30, description: "El barrio más auténtico de Roma. Callecitas medievales y trattorie locales", emoji: "🏡", openFrom: 0, openUntil: 24 },
    { name: "Giardino degli Aranci", type: "fotografia", lat: 41.8869, lng: 12.4797, durationMinutes: 20, description: "Jardín de los naranjos en el Aventino. Panorámica secreta de Roma y el Vaticano", emoji: "🍊", openFrom: 7, openUntil: 21 },
    { name: "Sant'Ivo alla Sapienza", type: "arte", lat: 41.8990, lng: 12.4735, durationMinutes: 20, description: "Obra maestra de Borromini. Solo abre domingo mañana — si coincide, no te la pierdas", emoji: "⛪", openFrom: 9, openUntil: 12 },
  ],
  tokyo: [
    { name: "Yanaka Ginza", type: "cultural", lat: 35.7238, lng: 139.7697, durationMinutes: 30, description: "Calle comercial del Tokio de los 50s. Tiendas locales y gatos callejeros", emoji: "🐱", openFrom: 10, openUntil: 19 },
    { name: "Nezu Shrine", type: "historia", lat: 35.7211, lng: 139.7620, durationMinutes: 25, description: "Santuario shinto del siglo VIII con torii rojos entre árboles. Menos visitado que Fushimi", emoji: "⛩️", openFrom: 9, openUntil: 17 },
    { name: "Koenji Shotengai", type: "shopping", lat: 35.7056, lng: 139.6491, durationMinutes: 30, description: "Mercado vintage y segunda mano. El barrio más bohemio de Tokio", emoji: "👘", openFrom: 11, openUntil: 20 },
  ],
  london: [
    { name: "Leadenhall Market", type: "historia", lat: 51.5130, lng: -0.0839, durationMinutes: 20, description: "Mercado victoriano cubierto de 1881. Inspiró Diagon Alley en Harry Potter", emoji: "🏛️", openFrom: 7, openUntil: 18 },
    { name: "Kyoto Garden, Holland Park", type: "naturaleza", lat: 51.5017, lng: -0.2024, durationMinutes: 25, description: "Jardín japonés escondido en Holland Park. Pavos reales y koi libres", emoji: "🌸", openFrom: 7, openUntil: 20 },
    { name: "Bermondsey Beer Mile", type: "gastronomia", lat: 51.4941, lng: -0.0784, durationMinutes: 30, description: "Ruta de cervecerías artesanales bajo los arcos victorianos. Solo sábados 10-17h", emoji: "🍺", openFrom: 10, openUntil: 17 },
  ],
  amsterdam: [
    { name: "Begijnhof", type: "historia", lat: 52.3694, lng: 4.8892, durationMinutes: 20, description: "Patio medieval secreto en el centro de Amsterdam. Solo se entra a pie", emoji: "🌷", openFrom: 9, openUntil: 17 },
    { name: "Albert Cuypmarkt", type: "gastronomia", lat: 52.3550, lng: 4.8978, durationMinutes: 30, description: "El mercado más grande de Holanda. Herring fresquísimo y stroopwafels", emoji: "🐟", openFrom: 9, openUntil: 17 },
  ],
}

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Is open now ─────────────────────────────────────────────────────────────

function isOpenNow(poi: CuratedPOI): boolean {
  const hour = new Date().getHours()
  return hour >= poi.openFrom && hour < poi.openUntil
}

// ─── Build NearbyPOI from curated ────────────────────────────────────────────

function toPOI(curated: CuratedPOI, distanceMeters: number): NearbyPOI {
  return {
    name: curated.name,
    type: curated.type,
    distanceMeters: Math.round(distanceMeters),
    lat: curated.lat,
    lng: curated.lng,
    openNow: isOpenNow(curated),
    durationMinutes: curated.durationMinutes,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${curated.lat},${curated.lng}`,
    description: curated.description,
    emoji: curated.emoji,
  }
}

// ─── Find nearby POIs ─────────────────────────────────────────────────────────

const DEFAULT_RADIUS_METERS = 600

export function findNearbyPOIs(ctx: MagicMomentContext, radiusMeters = DEFAULT_RADIUS_METERS): NearbyPOI[] {
  const cityKey = ctx.destination.toLowerCase().trim()

  // Try exact match, then partial match
  let candidates = POI_DATABASE[cityKey]
  if (!candidates) {
    const found = Object.keys(POI_DATABASE).find(k => cityKey.includes(k) || k.includes(cityKey))
    candidates = found ? POI_DATABASE[found] : []
  }

  return candidates
    .map(poi => ({
      poi,
      dist: haversineMeters(ctx.currentLat, ctx.currentLng, poi.lat, poi.lng),
    }))
    .filter(({ dist }) => dist <= radiusMeters)
    .map(({ poi, dist }) => toPOI(poi, dist))
}

// ─── Score a POI ──────────────────────────────────────────────────────────────

export function scorePOI(poi: NearbyPOI, ctx: MagicMomentContext): number {
  if (!poi.openNow) return 0

  // Not enough time in the gap
  const timeNeeded = poi.durationMinutes + 5 // 5 min buffer to arrive
  if (ctx.minutesToNext < timeNeeded + 10) return 0

  let score = 100

  // Interest match bonus
  const interests = ctx.userInterests.map(i => i.toLowerCase())
  if (interests.includes(poi.type.toLowerCase())) score += 40

  // Distance bonus (closer = better, max 50 points for <100m)
  const distScore = Math.max(0, 50 - (poi.distanceMeters / 10))
  score += distScore

  // Time fit: penalize if very tight
  const timeSlack = ctx.minutesToNext - timeNeeded
  if (timeSlack < 15) score -= 20
  else if (timeSlack > 30) score += 10

  // Day fatigue penalty: late in the day → less energy for detours
  if (ctx.dayProgress > 0.75) score -= 25
  else if (ctx.dayProgress > 0.6) score -= 10

  return Math.max(0, score)
}

// ─── Build suggestion ─────────────────────────────────────────────────────────

const REASON_TEMPLATES: Partial<Record<string, string[]>> = {
  gastronomia: [
    "Estás a {dist}m de {name} — hay tiempo para una parada rápida antes de llegar a {next}.",
    "A {dist}m tienes {name}. {desc} Vale la pena el desvío.",
  ],
  arte: [
    "Pasas cerca de {name}. {desc} Son solo {dur} min.",
    "A {dist}m hay una parada cultural perfecta: {name}.",
  ],
  naturaleza: [
    "A {dist}m tienes {name} — un respiro verde antes de continuar hacia {next}.",
    "Momento ideal para {name}: estás a {dist}m y tienes {gap} min libres.",
  ],
  fotografia: [
    "¿Ves {name}? A {dist}m y con {gap} min libres, es el momento ideal para una foto espectacular.",
    "A {dist}m tienes {name} — de las mejores vistas de la ciudad. Merece el desvío.",
  ],
  historia: [
    "Pasas a {dist}m de {name}. {desc} Visita rápida de {dur} min.",
    "A {dist}m hay un rincón histórico que pocos visitan: {name}.",
  ],
  cultural: [
    "A {dist}m tienes {name} — el barrio local auténtico que no aparece en los tours.",
    "Cerca tienes {name}. {desc}",
  ],
}

const GENERIC_REASONS = [
  "A {dist}m tienes {name}. {desc} Tienes {gap} min antes de {next}.",
  "{name} está a solo {dist}m. {desc} Lo justo para una parada rápida.",
  "Momento mágico: {name} a {dist}m. Tienes {gap} min — perfecto para un desvío.",
]

function buildReason(poi: NearbyPOI, ctx: MagicMomentContext): string {
  const templates = REASON_TEMPLATES[poi.type] ?? GENERIC_REASONS
  const template = templates[Math.floor(Math.random() * templates.length)]

  return template
    .replace("{name}", poi.name)
    .replace("{dist}", String(poi.distanceMeters))
    .replace("{desc}", poi.description ?? "")
    .replace("{dur}", String(poi.durationMinutes))
    .replace("{gap}", String(ctx.minutesToNext))
    .replace("{next}", ctx.nextActivity.name)
}

export function buildMagicMomentSuggestion(
  pois: NearbyPOI[],
  ctx: MagicMomentContext
): MagicMomentSuggestion | null {
  // Need at least 20 min gap to be worth a suggestion
  if (ctx.minutesToNext < 20) return null
  if (pois.length === 0) return null

  const scored = pois
    .map(poi => ({ poi, score: scorePOI(poi, ctx) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null

  const best = scored[0]
  return {
    poi: best.poi,
    reason: buildReason(best.poi, ctx),
    score: best.score,
  }
}
