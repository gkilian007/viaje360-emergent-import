import { NextRequest } from "next/server"
import { z } from "zod"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { normalizeRouteError, parseJsonBody, successResponse } from "@/lib/api/route-helpers"

const requestSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional().default(""),
  destination: z.string().optional().default(""),
  type: z.string().optional().default("tour"),
  imageQuery: z.string().optional(),
  url: z.string().optional(),
})

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeName(value: string): string {
  return normalizeText(value).toLowerCase()
}

function buildMapsUrl(name: string, location: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${location}`.trim())}`
}

async function fetchWithTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ])
  } catch {
    return null
  }
}

async function fetchWikipediaImage(searchTerm: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      gsrsearch: searchTerm,
      generator: "search",
      gsrlimit: "1",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "800",
    })

    const res = await fetch(`${WIKIPEDIA_API}?${params}`, { cache: "no-store" })
    if (!res.ok) return null

    const data = await res.json()
    const pages = data.query?.pages
    if (!pages) return null

    const page = Object.values(pages)[0] as { thumbnail?: { source?: string } }
    return page?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

async function fetchGooglePlacesPhoto(searchTerm: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  try {
    const params = new URLSearchParams({
      input: searchTerm,
      inputtype: "textquery",
      fields: "photos",
      key: apiKey,
    })

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`,
      { cache: "no-store" }
    )
    if (!res.ok) return null

    const data = await res.json()
    const photoRef = data.candidates?.[0]?.photos?.[0]?.photo_reference
    if (!photoRef) return null

    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`
  } catch {
    return null
  }
}

function chooseBestUrl(input: {
  type: string
  providedUrl?: string | null
  officialUrl?: string | null
  bookingUrl?: string | null
  menuUrl?: string | null
  name: string
  location: string
}) {
  const mapsUrl = buildMapsUrl(input.name, input.location)
  const direct = input.type === "restaurant"
    ? input.menuUrl || input.officialUrl || input.providedUrl || null
    : input.bookingUrl || input.officialUrl || input.providedUrl || null

  const suspicious = !direct || !/^https?:\/\//i.test(direct) || /example\.com|placeholder|localhost|\.test\//i.test(direct)
  const isMaps = !!direct && /google\.(com|es)\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(direct)

  if (suspicious || isMaps) {
    return {
      primaryUrl: mapsUrl,
      primaryKind: "maps" as const,
      mapsUrl,
    }
  }

  return {
    primaryUrl: direct,
    primaryKind: input.type === "restaurant" ? "menu" as const : "booking" as const,
    mapsUrl,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, requestSchema)
    const normalizedName = normalizeName(body.name)
    const normalizedDestination = normalizeText(body.destination)
    const mapsUrl = buildMapsUrl(body.name, body.location)

    if (!isSupabaseConfigured()) {
      return successResponse({
        imageUrl: null,
        imageSource: null,
        primaryUrl: body.url || mapsUrl,
        primaryKind: body.type === "restaurant" ? "menu" : "booking",
        mapsUrl,
        cached: false,
      })
    }

    const supabase = createServiceClient()

    const { data: knowledge } = await supabase
      .from("activity_knowledge")
      .select("id, official_url, booking_url, menu_url, metadata")
      .eq("destination", normalizedDestination)
      .eq("normalized_name", normalizedName)
      .maybeSingle()

    const metadata = (knowledge?.metadata ?? {}) as Record<string, unknown>
    const cachedImageUrl = typeof metadata.image_url === "string" ? metadata.image_url : null
    const cachedImageSource = typeof metadata.image_source === "string" ? metadata.image_source : null

    const best = chooseBestUrl({
      type: body.type,
      providedUrl: body.url ?? null,
      officialUrl: knowledge?.official_url ?? null,
      bookingUrl: knowledge?.booking_url ?? null,
      menuUrl: knowledge?.menu_url ?? null,
      name: body.name,
      location: body.location,
    })

    if (cachedImageUrl) {
      return successResponse({
        imageUrl: cachedImageUrl,
        imageSource: cachedImageSource,
        primaryUrl: best.primaryUrl,
        primaryKind: best.primaryKind,
        mapsUrl: best.mapsUrl,
        cached: true,
      })
    }

    // Resolve image server-side
    let imageUrl: string | null = null
    let imageSource: string | null = null

    // Build search term with destination context to avoid ambiguous results
    const baseTerm = body.imageQuery || body.name
    const searchWithContext = normalizedDestination && !baseTerm.toLowerCase().includes(normalizedDestination.toLowerCase())
      ? `${baseTerm} ${body.destination}`
      : baseTerm

    imageUrl = await fetchWithTimeout(fetchGooglePlacesPhoto(searchWithContext), 5000)
    if (imageUrl) imageSource = "google_places"

    if (!imageUrl) {
      imageUrl = await fetchWithTimeout(fetchWikipediaImage(searchWithContext), 5000)
      if (imageUrl) imageSource = "wikipedia"
    }
    if (!imageUrl && searchWithContext !== body.name) {
      const nameWithDest = normalizedDestination ? `${body.name} ${body.destination}` : body.name
      imageUrl = await fetchWithTimeout(fetchWikipediaImage(nameWithDest), 5000)
      if (imageUrl) imageSource = "wikipedia"
    }

    if (knowledge?.id) {
      const nextMetadata = {
        ...metadata,
        image_url: imageUrl,
        image_source: imageSource,
        image_verified_at: new Date().toISOString(),
        resolved_url: best.primaryUrl,
        resolved_url_type: best.primaryKind,
        resolved_url_verified_at: new Date().toISOString(),
      }

      const patch: Record<string, unknown> = {
        metadata: nextMetadata,
      }

      if (body.type === "restaurant") {
        if (!knowledge.menu_url && best.primaryKind === "menu") patch.menu_url = best.primaryUrl
        if (!knowledge.official_url && best.primaryKind !== "maps") patch.official_url = best.primaryUrl
      } else {
        if (!knowledge.booking_url && best.primaryKind === "booking") patch.booking_url = best.primaryUrl
        if (!knowledge.official_url && best.primaryKind !== "maps") patch.official_url = best.primaryUrl
      }

      await supabase.from("activity_knowledge").update(patch).eq("id", knowledge.id)
    }

    return successResponse({
      imageUrl,
      imageSource,
      primaryUrl: best.primaryUrl,
      primaryKind: best.primaryKind,
      mapsUrl: best.mapsUrl,
      cached: false,
    })
  } catch (error) {
    return normalizeRouteError(error, "Failed to resolve activity assets")
  }
}
