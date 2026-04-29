import { createClient } from "@supabase/supabase-js"
import fs from "node:fs/promises"
import path from "node:path"

function parseEnvFile(content) {
  return Object.fromEntries(
    content
      .split(/\n/)
      .map((line) => line.match(/^([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^"|"$/g, "")])
  )
}

function normalizeText(value) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function slugify(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "trip"
}

const envFile = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8")
const env = parseEnvFile(envFile)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: versions, error } = await supabase
  .from("itinerary_versions")
  .select(`
    id,
    trip_id,
    version_number,
    created_at,
    snapshot,
    trips!inner(
      destination,
      name,
      onboarding_id,
      created_at
    )
  `)
  .order("created_at", { ascending: false })
  .limit(200)

if (error) {
  console.error(error)
  process.exit(1)
}

const library = []
for (const row of versions ?? []) {
  const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips
  if (!trip || !row.snapshot?.days?.length) continue

  library.push({
    id: `${slugify(trip.destination)}-${row.trip_id}-v${row.version_number}`,
    tripId: row.trip_id,
    versionId: row.id,
    destination: trip.destination,
    tripName: row.snapshot.tripName,
    dayCount: row.snapshot.days.length,
    createdAt: row.created_at,
    snapshot: row.snapshot,
  })
}

const outputDir = path.join(process.cwd(), "knowledge", "seed-itineraries")
await fs.mkdir(outputDir, { recursive: true })
const outputPath = path.join(outputDir, "library.json")
await fs.writeFile(outputPath, JSON.stringify(library, null, 2) + "\n", "utf8")
console.log(`Exported ${library.length} reusable itineraries to ${outputPath}`)
