# Viaje360 — GSD Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Llevar Viaje360 de MVP a app competitiva con 16 mejoras agrupadas en 5 fases, ejecutables incrementalmente.

**Architecture:** Next.js 16 + Supabase + Gemini + Leaflet. Cada fase es independiente y deployable. Prioridad: UX del viaje primero, luego social, inteligencia, visual, y monetización.

**Tech Stack:** Next.js 16, React 19, Supabase, Gemini 2.5 Flash, Leaflet, Tailwind, Framer Motion, Google APIs, PWA/Service Worker.

---

## Fase 1: UX del Viaje en Tiempo Real (1-2 días)
_Lo que más impacta al usuario durante el viaje._

### Task 1.1: Tiempo de desplazamiento entre actividades

**Files:**
- Create: `src/lib/services/directions.service.ts`
- Create: `src/app/api/directions/route.ts`
- Modify: `src/components/features/TimelineItem.tsx`
- Modify: `src/lib/types.ts`

**Qué hacer:**
1. Nuevo servicio que calcula tiempo andando entre dos coordenadas via OSRM (gratuito, sin API key):
   - `GET https://router.project-osrm.org/route/v1/walking/{lng1},{lat1};{lng2},{lat2}?overview=false`
   - Devuelve `duration` (segundos) y `distance` (metros)
2. API route `/api/directions` que recibe `fromLat,fromLng,toLat,toLng` y devuelve `{ walkingMinutes, distanceMeters, mapsUrl }`
3. En `TimelineItem`, entre cada actividad mostrar un chip: `🚶 12 min · 850m` con link a Google Maps directions
4. Cachear resultados en `activity_knowledge.metadata.walking_time_to_next`

**Commit:** `feat: show walking time between activities in timeline`

---

### Task 1.2: Drag & drop para reordenar actividades

**Files:**
- Install: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- Modify: `src/app/plan/page.tsx`
- Modify: `src/components/features/TimelineItem.tsx`
- Create: `src/app/api/itinerary/reorder/route.ts`

**Qué hacer:**
1. Envolver la lista de actividades del día con `DndContext` + `SortableContext` de dnd-kit
2. Cada `TimelineItem` se convierte en `useSortable` — drag handle visible al mantener pulsado
3. Al soltar, actualizar el orden en el store local + POST a `/api/itinerary/reorder` con `{ tripId, dayNumber, activityIds: [...orderedIds] }`
4. El endpoint actualiza `start_time` de cada actividad en Supabase según el nuevo orden
5. Recalcular tiempos automáticamente manteniendo las duraciones originales

**Commit:** `feat: drag and drop to reorder activities within a day`

---

### Task 1.3: Vista "hoy" en tiempo real

**Files:**
- Modify: `src/app/plan/page.tsx`
- Create: `src/components/features/CurrentActivityBanner.tsx`
- Create: `src/lib/hooks/useCurrentActivity.ts`

**Qué hacer:**
1. Hook `useCurrentActivity(activities, selectedDay)` que compara `Date.now()` con los `time`/`endTime` de cada actividad
   - Devuelve `{ current, next, minutesToNext, progress }`
2. Banner sticky en la parte superior del timeline:
   - "Ahora: 🏛️ Museo del Prado — quedan 45 min"
   - Barra de progreso visual
   - "Siguiente: 🍴 Lateral Santa Ana en 15 min"
3. Auto-scroll a la actividad actual al cargar la página
4. Highlight visual: la actividad actual tiene borde azul pulsante

**Commit:** `feat: real-time current activity tracking with countdown`

---

### Task 1.4: Notificaciones push (PWA)

**Files:**
- Create: `public/sw.js`
- Create: `src/lib/services/notifications.service.ts`
- Create: `src/app/api/notifications/subscribe/route.ts`
- Create: `src/app/api/notifications/send/route.ts`
- Modify: `src/app/layout.tsx` (registrar service worker)
- Create: `public/manifest.json` (si no existe)

**Qué hacer:**
1. Service worker con push notifications via Web Push API
2. Al activar notificaciones, guardar `PushSubscription` en Supabase (`push_subscriptions` table)
3. Cron o edge function que revisa actividades del día del usuario y envía push 30 min antes:
   - "En 30 min tienes Museo del Prado. Tip: entra por la puerta de Goya"
4. Incluir el `notes` de la actividad en la notificación como tip práctico
5. Botón en `/plan` para activar/desactivar notificaciones

**Commit:** `feat: push notifications 30 min before each activity`

---

### Task 1.5: Modo offline (PWA + Service Worker)

**Files:**
- Modify: `public/sw.js`
- Modify: `public/manifest.json`
- Create: `src/lib/hooks/useOfflineItinerary.ts`
- Modify: `next.config.ts` (headers para caching)

**Qué hacer:**
1. Cachear en service worker: shell de la app, CSS, JS, fuentes, iconos de Material Symbols
2. Al cargar un itinerario, guardarlo en IndexedDB (con tiles del mapa de la zona)
3. Hook `useOfflineItinerary` que lee de IndexedDB si no hay red
4. Indicador "Offline" en el header cuando no hay conexión
5. Queue de cambios (feedback, lock, bookmark) que se sincroniza cuando vuelve la red
6. Manifest completo para "Add to Home Screen" en iOS/Android

**Commit:** `feat: offline mode with cached itinerary and map tiles`

---

## Fase 2: Experiencia Social (1 día)

### Task 2.1: Compartir itinerario (link público)

**Files:**
- Create: `src/app/shared/[tripId]/page.tsx`
- Create: `src/app/api/trips/share/route.ts`
- Modify: `src/app/plan/page.tsx` (botón compartir)

**Qué hacer:**
1. Endpoint `POST /api/trips/share` → genera un `share_token` UUID, guarda en `trips.share_token`
2. Página `/shared/[tripId]` — vista read-only del itinerario (sin auth, sin adapt)
3. Botón de compartir en `/plan` que genera el link y abre el share sheet nativo (`navigator.share`)
4. La página compartida muestra: nombre del viaje, timeline por día, mapa, pero sin feedback ni edición
5. OG meta tags para preview bonito en WhatsApp/Telegram

**Commit:** `feat: shareable public link for trip itinerary`

---

### Task 2.2: Viaje colaborativo

**Files:**
- Create: `supabase/migrations/XXX_trip_collaborators.sql`
- Create: `src/app/api/trips/invite/route.ts`
- Create: `src/components/features/CollaboratorsPanel.tsx`
- Modify: `src/app/plan/page.tsx`

**Qué hacer:**
1. Tabla `trip_collaborators`: `trip_id, user_id, role (owner|editor|viewer), invited_at`
2. Invitar por email → envía link con token → al aceptar, se añade como collaborator
3. Editors pueden: reordenar, marcar reservado, dar feedback. Viewers solo ven.
4. Panel lateral con avatares de los colaboradores conectados
5. Realtime via Supabase subscriptions para ver cambios del otro

**Commit:** `feat: collaborative trips with invite and roles`

---

### Task 2.3: Fotos del día + álbum automático

**Files:**
- Create: `src/app/plan/photos/page.tsx`
- Create: `src/app/api/photos/upload/route.ts`
- Create: `src/components/features/PhotoGallery.tsx`
- Modify: `src/components/features/ActivityDetailModal.tsx`

**Qué hacer:**
1. Botón "📸 Añadir foto" en cada actividad del modal
2. Upload a Supabase Storage (`trip-photos/{tripId}/{activityId}/`)
3. Galería por día en `/plan/photos` con grid de fotos agrupadas por actividad
4. Al final del viaje: botón "Generar álbum" que crea un PDF/HTML con fotos + itinerario
5. Las fotos se muestran como thumbnails en el timeline junto a cada actividad

**Commit:** `feat: photo upload per activity with day gallery`

---

## Fase 3: Inteligencia (1 día)

### Task 3.1: Adaptación por clima en tiempo real

**Files:**
- Create: `src/lib/services/weather.service.ts`
- Create: `src/app/api/weather/route.ts`
- Create: `src/components/features/WeatherAlert.tsx`
- Modify: `src/app/plan/page.tsx`

**Qué hacer:**
1. Servicio que consulta Open-Meteo (gratis, sin API key):
   - `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&daily=precipitation_probability_max,temperature_2m_max&timezone=auto`
2. Si probabilidad de lluvia > 60% para mañana, mostrar alerta:
   - "🌧️ Mañana lluvia probable. ¿Quieres que adapte el plan con más actividades de interior?"
3. Botón "Adaptar" que llama a `/api/itinerary/adapt` con reason: "Lluvia prevista, priorizar actividades de interior"
4. Widget de clima compacto en el header del día (temp + icono)

**Commit:** `feat: weather-based itinerary adaptation suggestions`

---

### Task 3.2: Tracking de presupuesto en vivo

**Files:**
- Create: `src/components/features/BudgetTracker.tsx`
- Create: `src/app/api/expenses/route.ts`
- Create: `supabase/migrations/XXX_trip_expenses.sql`
- Modify: `src/app/plan/page.tsx`

**Qué hacer:**
1. Tabla `trip_expenses`: `trip_id, activity_id, amount, category, note, created_at`
2. En cada actividad del modal: botón "💰 Registrar gasto" → input rápido de cantidad
3. Widget en `/plan` que muestra: presupuesto total vs gastado, barra de progreso por categoría
4. Alerta cuando gastos > 80% del presupuesto: "⚠️ Llevas €420 de €500"
5. Resumen al final de cada día: "Hoy gastaste €85 — quedan €415 para 3 días"

**Commit:** `feat: live budget tracking with per-activity expenses`

---

### Task 3.3: Alternativas instantáneas

**Files:**
- Create: `src/app/api/activity-alternatives/route.ts`
- Create: `src/components/features/AlternativesSheet.tsx`
- Modify: `src/components/features/ActivityDetailModal.tsx`

**Qué hacer:**
1. Botón "🔄 Ver alternativas" en el modal de actividad
2. Endpoint que pide a Gemini 3 alternativas del mismo tipo en la misma zona:
   - "Sugiere 3 alternativas a [nombre] de tipo [tipo] cerca de [lat,lng] en [destino]"
3. Bottom sheet con 3 tarjetas: nombre, ubicación, por qué es buena alternativa, botón "Reemplazar"
4. Al reemplazar: actualiza la actividad en el itinerario sin regenerar todo el día
5. El reemplazo preserva la hora y duración original

**Commit:** `feat: instant activity alternatives without full regeneration`

---

## Fase 4: Visual y UX (1 día)

### Task 4.1: Fotos reales fiables (Unsplash + Places)

**Files:**
- Modify: `src/app/api/activity-assets/route.ts`
- Create: `src/lib/services/unsplash.service.ts`

**Qué hacer:**
1. Añadir Unsplash API como fuente de imágenes (gratis hasta 50 req/hr):
   - Buscar `{activity.name} {destination}`
   - Imágenes de alta calidad, sin escudos ni logos
2. Cascade de prioridad: Google Places → Unsplash → Wikipedia → gradient fallback
3. Cachear `image_url` + `image_source` en `activity_knowledge.metadata` tras primera resolución
4. Pre-resolver imágenes de todas las actividades al generar el itinerario (background job)

**Commit:** `feat: reliable activity photos with Unsplash fallback`

---

### Task 4.2: Ruta real en el mapa (calles reales)

**Files:**
- Modify: `src/components/features/RealMapView.tsx`
- Create: `src/lib/services/route-geometry.service.ts`

**Qué hacer:**
1. Usar OSRM para obtener la geometría real de la ruta andando entre actividades consecutivas:
   - `GET https://router.project-osrm.org/route/v1/walking/{coords}?overview=full&geometries=geojson`
2. Reemplazar la polyline recta actual por la polyline real siguiendo calles
3. Colorear segmentos por tipo de la actividad destino (mismos colores que los markers)
4. Cachear geometrías en el store para no re-fetchar

**Commit:** `feat: real walking route polylines on map`

---

### Task 4.3: Vista calendario semanal

**Files:**
- Create: `src/components/features/CalendarView.tsx`
- Modify: `src/app/plan/page.tsx`

**Qué hacer:**
1. Toggle en `/plan`: "Timeline | Calendario"
2. Vista calendario tipo Google Calendar: días como columnas, actividades como bloques de color según tipo
3. Los bloques muestran: emoji + nombre + hora. Click abre el modal de detalle.
4. Visualmente permite ver a un vistazo cómo está distribuido el día y qué tipo de actividades domina

**Commit:** `feat: weekly calendar view for trip overview`

---

## Fase 5: Monetización (1 día)

### Task 5.1: Reservas integradas (afiliados)

**Files:**
- Create: `src/lib/services/booking.service.ts`
- Create: `src/components/features/BookingCTA.tsx`
- Modify: `src/components/features/ActivityDetailModal.tsx`

**Qué hacer:**
1. Para restaurantes: link a TheFork/Google con UTM params de afiliado
2. Para museos/monumentos: link a GetYourGuide o Tiqets con programa de afiliados
3. En el modal: botón prominent "Reservar ahora" que trackea clicks (evento `booking_clicked`)
4. Lógica de detección: si la actividad tiene URL oficial de booking, usar esa; sino fallback a Google
5. Dashboard simple de clicks de afiliado en `/api/admin/affiliate-stats`

**Commit:** `feat: affiliate booking links for restaurants and attractions`

---

### Task 5.2: Premium features (paywall mejorado)

**Files:**
- Modify: `src/lib/hooks/useAccess.ts`
- Modify: `src/components/features/TrialBanner.tsx`
- Create: `src/components/features/PremiumUpsell.tsx`

**Qué hacer:**
1. Free tier: 1 viaje activo, 2 adaptaciones/día, sin notificaciones push, sin colaboración
2. Premium (€4.99/mes): viajes ilimitados, adaptaciones ilimitadas, push, colaboración, fotos, offline
3. Upsell contextual: cuando el usuario intenta hacer algo premium, mostrar modal con beneficios
4. Stripe checkout ya está implementado — conectar los nuevos features al flag `hasAccess`

**Commit:** `feat: premium tier with contextual upsell for new features`

---

## Orden de ejecución recomendado

| Prioridad | Task | Impacto | Esfuerzo |
|-----------|------|---------|----------|
| 🔴 1 | 1.1 Tiempo desplazamiento | Alto | Bajo |
| 🔴 2 | 1.3 Vista "hoy" tiempo real | Alto | Bajo |
| 🔴 3 | 3.1 Clima en tiempo real | Alto | Bajo |
| 🔴 4 | 4.2 Ruta real en mapa | Alto | Medio |
| 🟡 5 | 1.2 Drag & drop reordenar | Alto | Medio |
| 🟡 6 | 3.3 Alternativas instantáneas | Alto | Medio |
| 🟡 7 | 4.1 Fotos fiables | Alto | Bajo |
| 🟡 8 | 3.2 Budget tracker | Medio | Medio |
| 🟡 9 | 2.1 Compartir itinerario | Medio | Bajo |
| 🟢 10 | 4.3 Vista calendario | Medio | Medio |
| 🟢 11 | 1.4 Push notifications | Medio | Alto |
| 🟢 12 | 1.5 Modo offline | Medio | Alto |
| 🟢 13 | 2.3 Fotos del día | Medio | Medio |
| 🟢 14 | 5.1 Reservas afiliados | Medio | Bajo |
| 🟢 15 | 2.2 Viaje colaborativo | Medio | Alto |
| 🟢 16 | 5.2 Premium paywall | Medio | Medio |

---

_Plan creado: 2026-03-26. Ejecutable task-by-task o en paralelo por subagentes._
