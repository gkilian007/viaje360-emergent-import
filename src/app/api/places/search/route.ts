import { NextRequest, NextResponse } from "next/server"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

interface PlaceResult {
  name: string
  type: string
  address: string
  neighborhood: string
  rating?: number
  priceLevel?: string
  notes: string
  kidFriendly: boolean
  petFriendly: boolean
  accessible: boolean
  dietaryOptions: string[]
  openingHours?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      query: string
      location: string
      filters?: {
        kidFriendly?: boolean
        petFriendly?: boolean
        dietary?: string[]
        accessible?: boolean
        type?: string
      }
    }

    if (!body.query || !body.location) {
      return NextResponse.json(
        { error: "query and location are required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const filters = body.filters ?? {}
    const filterText = [
      filters.kidFriendly ? "kid-friendly" : "",
      filters.petFriendly ? "pet-friendly" : "",
      filters.accessible ? "wheelchair accessible" : "",
      ...(filters.dietary ?? []),
      filters.type ?? "",
    ].filter(Boolean).join(", ")

    const prompt = `You are a travel expert. Find places in ${body.location} matching: "${body.query}".
${filterText ? `Required filters: ${filterText}` : ""}

Return ONLY valid JSON array with 5 results:
[
  {
    "name": "Place name",
    "type": "restaurant|museum|monument|park|shopping|tour|hotel",
    "address": "Full address",
    "neighborhood": "Neighborhood",
    "rating": 4.5,
    "priceLevel": "€|€€|€€€|€€€€",
    "notes": "Brief description and tips",
    "kidFriendly": true,
    "petFriendly": false,
    "accessible": true,
    "dietaryOptions": ["vegetarian", "vegan"],
    "openingHours": "9:00-20:00"
  }
]`

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }

    const data = await res.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>
    }

    const raw = data.candidates[0]?.content?.parts[0]?.text ?? "[]"
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()

    let places: PlaceResult[]
    try {
      places = JSON.parse(cleaned) as PlaceResult[]
    } catch {
      places = []
    }

    return NextResponse.json({ places })
  } catch (err) {
    console.error("places/search error:", err)
    return NextResponse.json(
      { error: "Failed to search places" },
      { status: 500 }
    )
  }
}
