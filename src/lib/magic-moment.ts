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

  berlin: [
    { name: "Mauerpark", type: "cultural", lat: 52.5420, lng: 13.4016, durationMinutes: 45, description: "Parque sobre el antiguo muro de Berlín. Mercadillo dominical, karaoke en anfiteatro y ambiente bohemio", emoji: "🎤", openFrom: 8, openUntil: 20 },
    { name: "Hackescher Markt", type: "gastronomia", lat: 52.5231, lng: 13.4022, durationMinutes: 30, description: "Pasajes Wilhelministas con galerías, cafés y tiendas de diseño. El corazón cool de Mitte", emoji: "🛍️", openFrom: 10, openUntil: 22 },
    { name: "Café Einstein Stammhaus", type: "gastronomia", lat: 52.5049, lng: 13.3441, durationMinutes: 25, description: "Histórico café vienés en una villa de 1878. El mejor Wiener Schnitzel y strudel de Berlín", emoji: "☕", openFrom: 9, openUntil: 23 },
    { name: "Tempelhofer Feld", type: "naturaleza", lat: 52.4730, lng: 13.4014, durationMinutes: 40, description: "Antiguo aeropuerto convertido en parque urbano gigante. Patinaje, barbacoas y puestas de sol épicas", emoji: "✈️", openFrom: 6, openUntil: 21 },
    { name: "RAW-Gelände", type: "nocturna", lat: 52.5056, lng: 13.4547, durationMinutes: 30, description: "Complejo industrial abandonado reconvertido en clubs, skate park y mercadillo. Alternativo puro", emoji: "🏭", openFrom: 12, openUntil: 24 },
    { name: "Bergmannstraße", type: "gastronomia", lat: 52.4895, lng: 13.3934, durationMinutes: 30, description: "La calle más bohemia de Kreuzberg: delicatessen, cafés hipster y anticuarios", emoji: "🌿", openFrom: 9, openUntil: 22 },
    { name: "Schloss Charlottenburg Jardines", type: "naturaleza", lat: 52.5208, lng: 13.2955, durationMinutes: 35, description: "Jardines barrocos del palacio de los Hohenzollern. Entrada libre al parque exterior", emoji: "🌷", openFrom: 8, openUntil: 20 },
  ],

  lisbon: [
    { name: "LX Factory", type: "cultural", lat: 38.7044, lng: -9.1760, durationMinutes: 45, description: "Complejo industrial rehabilitado con restaurantes, librerías y mercado dominical. El barrio creativo de Lisboa", emoji: "🏭", openFrom: 10, openUntil: 24 },
    { name: "Pastéis de Belém", type: "gastronomia", lat: 38.6972, lng: -9.2037, durationMinutes: 20, description: "La pastelería original de los pastéis de nata desde 1837. Cola inevitable pero vale cada minuto", emoji: "🥮", openFrom: 8, openUntil: 23 },
    { name: "Miradouro da Graça", type: "fotografia", lat: 38.7157, lng: -9.1311, durationMinutes: 25, description: "El mirador más secreto de Lisboa. Vista al castillo y al Tejo sin las hordas del Portas do Sol", emoji: "🌅", openFrom: 0, openUntil: 24 },
    { name: "Feira da Ladra", type: "shopping", lat: 38.7175, lng: -9.1286, durationMinutes: 40, description: "Mercado de pulgas al aire libre en el Campo de Santa Clara. Martes y sábados", emoji: "🪙", openFrom: 9, openUntil: 18 },
    { name: "Tasca do Chico", type: "gastronomia", lat: 38.7115, lng: -9.1430, durationMinutes: 30, description: "Tasca pequeñísima en Alfama con fado en vivo. Reserva imprescindible pero intenta colarte", emoji: "🎶", openFrom: 20, openUntil: 24 },
    { name: "Elevador da Bica", type: "historia", lat: 38.7099, lng: -9.1453, durationMinutes: 15, description: "El funicular más fotogénico de Lisboa bajando por el Bairro Alto. Icónico", emoji: "🚃", openFrom: 7, openUntil: 21 },
  ],

  seoul: [
    { name: "Insadong", type: "cultural", lat: 37.5742, lng: 126.9855, durationMinutes: 45, description: "Calle peatonal con galerías de arte, tiendas tradicionales y cafés temáticos. El alma artística de Seúl", emoji: "🎨", openFrom: 10, openUntil: 22 },
    { name: "Gwangjang Market", type: "gastronomia", lat: 37.5700, lng: 126.9997, durationMinutes: 40, description: "El mercado de comida más antiguo de Seúl (1905). Bindaetteok, bibimbap y sesos fritos auténticos", emoji: "🥟", openFrom: 9, openUntil: 23 },
    { name: "Bukchon Hanok Village", type: "fotografia", lat: 37.5826, lng: 126.9830, durationMinutes: 35, description: "600 casas hanok tradicionales entre colinas. Mejor a primera hora para evitar turistas", emoji: "🏯", openFrom: 6, openUntil: 21 },
    { name: "Ihwa Mural Village", type: "arte", lat: 37.5799, lng: 127.0057, durationMinutes: 25, description: "Barrio de murales cerca del Parque Naksan. El gato de la colina es inconfundible", emoji: "🐱", openFrom: 0, openUntil: 24 },
    { name: "Noryangjin Fish Market", type: "gastronomia", lat: 37.5110, lng: 126.9422, durationMinutes: 40, description: "Mercado de pescado abierto 24h. Elige tu marisco vivo y se lo cocinan en el restaurante de encima", emoji: "🦞", openFrom: 0, openUntil: 24 },
    { name: "Dongdaemun Design Plaza", type: "arte", lat: 37.5671, lng: 127.0095, durationMinutes: 30, description: "Edificio futurista de Zaha Hadid. Diseño, moda y vistas nocturnas increíbles desde la plaza", emoji: "🌐", openFrom: 10, openUntil: 21 },
  ],

  dubai: [
    { name: "Al Fahidi Historical Neighbourhood", type: "historia", lat: 25.2635, lng: 55.2966, durationMinutes: 40, description: "Barrio más antiguo de Dubái con torres de viento y museos locales. Refrescante contraste al skyline", emoji: "🏺", openFrom: 8, openUntil: 20 },
    { name: "Spice Souk", type: "gastronomia", lat: 25.2694, lng: 55.3013, durationMinutes: 25, description: "Zoco de especias junto al Creek. Azafrán iraní, pimienta rosa y cardamomo a granel", emoji: "🌶️", openFrom: 9, openUntil: 22 },
    { name: "Gold Souk", type: "shopping", lat: 25.2702, lng: 55.3008, durationMinutes: 30, description: "El mayor zoco de oro del mundo con 300+ tiendas. Negociación obligatoria", emoji: "💛", openFrom: 9, openUntil: 22 },
    { name: "Alserkal Avenue", type: "arte", lat: 25.1532, lng: 55.2196, durationMinutes: 35, description: "Complejo de arte contemporáneo en Al Quoz. Galerías internacionales en naves industriales", emoji: "🖼️", openFrom: 10, openUntil: 19 },
  ],

  "mexico city": [
    { name: "Barrio de Coyoacán", type: "cultural", lat: 19.3501, lng: -99.1628, durationMinutes: 60, description: "Barrio colonial bohemio, casa de Frida Kahlo y León Trotsky. Mercado artesanal y cantinas centenarias", emoji: "🎨", openFrom: 8, openUntil: 22 },
    { name: "Mercado Jamaica", type: "gastronomia", lat: 19.4180, lng: -99.1209, durationMinutes: 30, description: "El mayor mercado de flores y plantas de México. Colores desbordantes y precios locales", emoji: "💐", openFrom: 5, openUntil: 19 },
    { name: "Xochimilco", type: "naturaleza", lat: 19.2577, lng: -99.1052, durationMinutes: 90, description: "Canales aztecas con trajineras de colores. Cerveza fría, marimba en vivo y flor de Jamaica", emoji: "🛶", openFrom: 9, openUntil: 18 },
    { name: "Mercado de Medellín", type: "gastronomia", lat: 19.4072, lng: -99.1734, durationMinutes: 30, description: "Mercado barrial de la Colonia Roma. Jugos tropicales, mariscos y el mejor chile en nogada de temporada", emoji: "🌮", openFrom: 7, openUntil: 20 },
    { name: "Librería El Péndulo", type: "cultural", lat: 19.4239, lng: -99.1707, durationMinutes: 25, description: "Librería-café con jardín interior en la Condesa. Café de olla y libros en español e inglés", emoji: "📚", openFrom: 8, openUntil: 22 },
  ],

  "buenos aires": [
    { name: "Mercado de San Telmo", type: "gastronomia", lat: -34.6219, lng: -58.3725, durationMinutes: 40, description: "Mercado cubierto de 1897 con antigüedades, café, empanadas y tango. El más auténtico de BA", emoji: "🥩", openFrom: 10, openUntil: 20 },
    { name: "La Boca — Caminito", type: "fotografia", lat: -34.6339, lng: -58.3632, durationMinutes: 30, description: "Calle museo al aire libre con casas pintadas de colores y tango callejero. Imprescindible antes de las 12h", emoji: "💃", openFrom: 8, openUntil: 20 },
    { name: "Recoleta Cemetery", type: "historia", lat: -34.5879, lng: -58.3935, durationMinutes: 40, description: "Cementerio laberíntico con mausoleos Art Nouveau. Evita Perón descansa aquí. Gratuito", emoji: "🌹", openFrom: 7, openUntil: 18 },
    { name: "Feria de Mataderos", type: "cultural", lat: -34.6543, lng: -58.5124, durationMinutes: 60, description: "Feria artesanal gaucha solo domingos. Jinetes, folk argentino y locro al mediodía", emoji: "🤠", openFrom: 11, openUntil: 20 },
    { name: "El Ateneo Grand Splendid", type: "cultural", lat: -34.5960, lng: -58.3933, durationMinutes: 20, description: "Una de las librerías más hermosas del mundo, en un teatro de ópera de 1919. Café en el escenario", emoji: "🎭", openFrom: 9, openUntil: 22 },
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

  // Try exact match, then partial match in curated DB
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

// ─── Overpass API — real-time POI search (server-side via /api/nearby) ────────
// Used as fallback when curated DB has no results for the destination.
// Caller is responsible for invoking this and merging with findNearbyPOIs results.

export interface OverpassPOI {
  name: string
  type: string
  lat: number
  lng: number
  distanceMeters: number
  mapsUrl: string
  emoji: string
  durationMinutes: number
  openNow: boolean
}

const OVERPASS_TYPE_MAP: Record<string, { emoji: string; type: string; duration: number }> = {
  museum: { emoji: "🏛️", type: "arte", duration: 60 },
  gallery: { emoji: "🖼️", type: "arte", duration: 30 },
  cafe: { emoji: "☕", type: "gastronomia", duration: 20 },
  restaurant: { emoji: "🍽️", type: "gastronomia", duration: 45 },
  bar: { emoji: "🍷", type: "gastronomia", duration: 25 },
  market: { emoji: "🛒", type: "gastronomia", duration: 30 },
  viewpoint: { emoji: "🌆", type: "fotografia", duration: 20 },
  park: { emoji: "🌳", type: "naturaleza", duration: 30 },
  garden: { emoji: "🌸", type: "naturaleza", duration: 25 },
  historic: { emoji: "🏺", type: "historia", duration: 20 },
  artwork: { emoji: "🎨", type: "arte", duration: 10 },
  fountain: { emoji: "⛲", type: "fotografia", duration: 10 },
  bookshop: { emoji: "📚", type: "cultural", duration: 20 },
  ice_cream: { emoji: "🍦", type: "gastronomia", duration: 10 },
}

export function overpassResultToNearbyPOI(
  element: { lat: number; lon: number; tags: Record<string, string> },
  fromLat: number,
  fromLng: number
): OverpassPOI | null {
  const tags = element.tags ?? {}
  const name = tags.name ?? tags["name:en"] ?? tags["name:es"]
  if (!name || name.length < 3) return null

  const dist = haversineMeters(fromLat, fromLng, element.lat, element.lon)
  const amenity = tags.amenity ?? tags.tourism ?? tags.historic ?? tags.leisure ?? ""
  const mapped = OVERPASS_TYPE_MAP[amenity] ?? { emoji: "📍", type: "cultural", duration: 20 }

  return {
    name,
    type: mapped.type,
    lat: element.lat,
    lng: element.lon,
    distanceMeters: Math.round(dist),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${element.lat},${element.lon}`,
    emoji: mapped.emoji,
    durationMinutes: mapped.duration,
    openNow: true, // Overpass doesn't have real-time hours — assume open
  }
}

export function overpassPOIToNearbyPOI(poi: OverpassPOI): NearbyPOI {
  return {
    name: poi.name,
    type: poi.type,
    distanceMeters: poi.distanceMeters,
    lat: poi.lat,
    lng: poi.lng,
    openNow: poi.openNow,
    durationMinutes: poi.durationMinutes,
    mapsUrl: poi.mapsUrl,
    emoji: poi.emoji,
    description: undefined,
  }
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
