/**
 * Script temporal para regenerar el contenido del trip de Barcelona
 * Elimina placeholders y traduce al español
 * Usage: node scripts/fix-trip-content.mjs
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://xhwkigbrdgojtesbztec.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TRIP_ID = "c3701728-22da-4dca-94a7-a7c12b3edc6b"
const GEMINI_KEY = process.env.GEMINI_API_KEY

if (!SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  console.error("Missing env vars: SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Get all activities with placeholder names or English content
const { data: days } = await supabase
  .from("itinerary_days")
  .select("id, day_number, date, theme")
  .eq("trip_id", TRIP_ID)
  .order("day_number", { ascending: true })

const { data: activities } = await supabase
  .from("activities")
  .select("*")
  .eq("trip_id", TRIP_ID)
  .order("sort_order", { ascending: true })

// Find placeholders
const placeholders = (activities ?? []).filter(act =>
  act.name?.includes("Family-friendly") ||
  act.name?.includes("break") ||
  act.name === "Accommodation" ||
  act.name?.includes("Auto-replaced")
)

console.log(`\nTotal activities: ${activities?.length}`)
console.log(`Placeholders found: ${placeholders.length}`)
placeholders.forEach(a => console.log(`  - [Day ${days?.find(d => d.id === a.day_id)?.day_number ?? "?"}] ${a.name} @ ${a.location}`))

if (placeholders.length === 0) {
  console.log("Nothing to fix!")
  process.exit(0)
}

// Build a prompt to get real replacements from Gemini
const dayGroups = {}
for (const act of placeholders) {
  const dayNum = days?.find(d => d.id === act.day_id)?.day_number ?? "?"
  if (!dayGroups[dayNum]) dayGroups[dayNum] = []
  dayGroups[dayNum].push(act)
}

const activitiesList = placeholders.map(act => {
  const dayNum = days?.find(d => d.id === act.day_id)?.day_number ?? "?"
  return `Day ${dayNum}: "${act.name}" at "${act.location}" (time: ${act.time}, duration: ${act.duration}min, cost: €${act.cost})`
}).join("\n")

const prompt = `Eres un experto en turismo en Barcelona, España.

Las siguientes actividades de un itinerario familiar en Barcelona son PLACEHOLDERS genéricos que hay que reemplazar con lugares REALES y ESPECÍFICOS:

${activitiesList}

Para cada una, dame un reemplazo real en formato JSON con estos campos:
- original_name: el nombre original (cópialo exactamente)
- name: nombre real del sitio en ESPAÑOL (ej: "Parc de la Ciutadella" o "Mercat de Santa Caterina")  
- type: restaurant|museum|monument|park|shopping|tour
- location: dirección real en catalán/castellano
- description: 1-2 frases en español de qué hacer allí
- notes: tip práctico en español
- lat: latitud decimal real
- lng: longitud decimal real
- url: URL real (oficial o Google Maps)

Reglas:
- SOLO lugares reales que existen en Barcelona
- Todo en español (castellano)
- Sin inglés
- Adecuados para una familia con niños
- Adaptados al tiempo de la actividad que reemplazan (misma duración aproximada)
- Geográficamente cercanos al barrio indicado en la dirección original

Responde SOLO con JSON válido: {"replacements": [...]}`

console.log("\nCalling Gemini to get replacements...")

const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
    })
  }
)

const geminiData = await geminiRes.json()
const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

let replacements
try {
  const parsed = JSON.parse(rawText)
  replacements = parsed.replacements
} catch {
  // Try to extract JSON from text
  const match = rawText.match(/\{[\s\S]*\}/)
  if (match) {
    const parsed = JSON.parse(match[0])
    replacements = parsed.replacements
  }
}

if (!replacements?.length) {
  console.error("Failed to parse Gemini response:", rawText.slice(0, 500))
  process.exit(1)
}

console.log(`\nGemini returned ${replacements.length} replacements`)

// Apply replacements to DB
let updated = 0
for (const rep of replacements) {
  const original = placeholders.find(a => a.name === rep.original_name)
  if (!original) {
    console.warn(`  Could not find activity "${rep.original_name}" in DB`)
    continue
  }

  const { error } = await supabase
    .from("activities")
    .update({
      name: rep.name,
      type: rep.type ?? original.type,
      location: rep.location ?? original.location,
      description: rep.description,
      notes: rep.notes,
      latitude: rep.lat ?? null,
      longitude: rep.lng ?? null,
      url: rep.url ?? null,
    })
    .eq("id", original.id)

  if (error) {
    console.error(`  Error updating "${rep.original_name}":`, error.message)
  } else {
    console.log(`  ✅ ${rep.original_name} → ${rep.name}`)
    updated++
  }
}

console.log(`\nDone! Updated ${updated}/${replacements.length} activities.`)
