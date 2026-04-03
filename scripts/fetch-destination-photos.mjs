#!/usr/bin/env node
/**
 * Fetch destination photos from Wikimedia Commons.
 * 
 * For each destination: grabs hero image + top POI images.
 * Saves metadata to JSON + downloads images to local directory.
 * 
 * Usage:
 *   node scripts/fetch-destination-photos.mjs [--tier 1] [--download] [--output ./data/photos]
 */

import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// ── Configuration ──

const TIER_1 = [
  {
    city: "Roma",
    country: "Italia",
    wiki: "Rome",
    pois: ["Colosseum", "Trevi Fountain", "Pantheon, Rome", "Roman Forum", "St. Peter's Basilica", "Spanish Steps", "Piazza Navona", "Vatican Museums"],
  },
  {
    city: "París",
    country: "Francia",
    wiki: "Paris",
    pois: ["Eiffel Tower", "Louvre", "Notre-Dame de Paris", "Arc de Triomphe", "Sacré-Cœur, Paris", "Musée d'Orsay", "Champs-Élysées", "Montmartre"],
  },
  {
    city: "Barcelona",
    country: "España",
    wiki: "Barcelona",
    pois: ["Sagrada Família", "Park Güell", "Casa Batlló", "La Rambla, Barcelona", "Gothic Quarter, Barcelona", "Casa Milà", "Camp Nou", "Barceloneta"],
  },
  {
    city: "Londres",
    country: "Reino Unido",
    wiki: "London",
    pois: ["Tower of London", "Big Ben", "Buckingham Palace", "Tower Bridge", "British Museum", "London Eye", "Westminster Abbey", "Hyde Park, London"],
  },
  {
    city: "Tokyo",
    country: "Japón",
    wiki: "Tokyo",
    pois: ["Senso-ji", "Shibuya Crossing", "Meiji Shrine", "Tokyo Tower", "Shinjuku", "Akihabara", "Imperial Palace, Tokyo", "Tsukiji fish market"],
  },
  {
    city: "Nueva York",
    country: "Estados Unidos",
    wiki: "New York City",
    pois: ["Statue of Liberty", "Central Park", "Times Square", "Empire State Building", "Brooklyn Bridge", "Metropolitan Museum of Art", "One World Trade Center", "Broadway theatre"],
  },
  {
    city: "Lisboa",
    country: "Portugal",
    wiki: "Lisbon",
    pois: ["Belém Tower", "Jerónimos Monastery", "Praça do Comércio", "Alfama", "Tram 28, Lisbon", "Pastéis de Belém", "São Jorge Castle", "LX Factory"],
  },
  {
    city: "Ámsterdam",
    country: "Países Bajos",
    wiki: "Amsterdam",
    pois: ["Rijksmuseum", "Anne Frank House", "Van Gogh Museum", "Vondelpark", "Jordaan, Amsterdam", "Amsterdam Canal Ring", "Dam Square", "Bloemenmarkt"],
  },
  {
    city: "Berlín",
    country: "Alemania",
    wiki: "Berlin",
    pois: ["Brandenburg Gate", "Berlin Wall", "Reichstag building", "Museum Island, Berlin", "Checkpoint Charlie", "East Side Gallery", "Berlin Cathedral", "Alexanderplatz"],
  },
  {
    city: "Madrid",
    country: "España",
    wiki: "Madrid",
    pois: ["Royal Palace of Madrid", "Museo del Prado", "Puerta del Sol", "Plaza Mayor, Madrid", "Retiro Park", "Reina Sofía Museum", "Gran Vía, Madrid", "Temple of Debod"],
  },
  {
    city: "Sevilla",
    country: "España",
    wiki: "Seville",
    pois: ["Alcázar of Seville", "Seville Cathedral", "Plaza de España, Seville", "Giralda", "Triana, Seville", "Metropol Parasol", "Torre del Oro", "Barrio de Santa Cruz, Seville"],
  },
  {
    city: "Praga",
    country: "República Checa",
    wiki: "Prague",
    pois: ["Charles Bridge", "Prague Castle", "Old Town Square, Prague", "Prague astronomical clock", "St. Vitus Cathedral", "John Lennon Wall", "Dancing House", "Petřín"],
  },
  {
    city: "Viena",
    country: "Austria",
    wiki: "Vienna",
    pois: ["Schönbrunn Palace", "St. Stephen's Cathedral, Vienna", "Belvedere, Vienna", "Hofburg", "Vienna State Opera", "Naschmarkt", "Prater", "Kunsthistorisches Museum"],
  },
  {
    city: "Estambul",
    country: "Turquía",
    wiki: "Istanbul",
    pois: ["Hagia Sophia", "Blue Mosque", "Grand Bazaar, Istanbul", "Topkapi Palace", "Galata Tower", "Basilica Cistern", "Bosphorus", "Dolmabahçe Palace"],
  },
  {
    city: "Bangkok",
    country: "Tailandia",
    wiki: "Bangkok",
    pois: ["Grand Palace, Bangkok", "Wat Arun", "Wat Pho", "Chatuchak Weekend Market", "Khao San Road", "Jim Thompson House", "Lumphini Park", "Chinatown, Bangkok"],
  },
  {
    city: "Dubái",
    country: "Emiratos Árabes",
    wiki: "Dubai",
    pois: ["Burj Khalifa", "Palm Jumeirah", "Dubai Mall", "Dubai Marina", "Burj Al Arab", "Dubai Frame", "Gold Souk", "Dubai Miracle Garden"],
  },
  {
    city: "Ciudad de México",
    country: "México",
    wiki: "Mexico City",
    pois: ["Zócalo, Mexico City", "Palacio de Bellas Artes", "Chapultepec Castle", "Teotihuacan", "Coyoacán", "Frida Kahlo Museum", "Angel of Independence", "Xochimilco"],
  },
  {
    city: "Buenos Aires",
    country: "Argentina",
    wiki: "Buenos Aires",
    pois: ["La Boca", "Plaza de Mayo", "Recoleta Cemetery", "Teatro Colón", "Obelisco de Buenos Aires", "San Telmo, Buenos Aires", "Palermo, Buenos Aires", "Casa Rosada"],
  },
  {
    city: "Marrakech",
    country: "Marruecos",
    wiki: "Marrakesh",
    pois: ["Jemaa el-Fnaa", "Bahia Palace", "Majorelle Garden", "Koutoubia Mosque", "Saadian Tombs", "Medina of Marrakesh", "Ben Youssef Madrasa", "Souks of Marrakesh"],
  },
  {
    city: "Singapur",
    country: "Singapur",
    wiki: "Singapore",
    pois: ["Marina Bay Sands", "Gardens by the Bay", "Merlion", "Sentosa", "Chinatown, Singapore", "Orchard Road", "Singapore Botanic Gardens", "Clarke Quay"],
  },
]

// ── Wikimedia Commons API ──

const COMMONS_API = "https://commons.wikimedia.org/w/api.php"
const WIKI_API = "https://en.wikipedia.org/w/api.php"

const HEADERS = {
  "User-Agent": "Viaje360/1.0 (travel-planning-app; contact@viaje360.app)",
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Get the main image from a Wikipedia article.
 * Returns { url, width, height, attribution, license } or null.
 */
async function getWikiMainImage(articleTitle) {
  try {
    // Step 1: Get the page's main image (thumbnail/og:image)
    const params = new URLSearchParams({
      action: "query",
      titles: articleTitle,
      prop: "pageimages|imageinfo",
      piprop: "original",
      iiprop: "url|extmetadata",
      format: "json",
      origin: "*",
    })

    const res = await fetch(`${WIKI_API}?${params}`, { headers: HEADERS })
    if (!res.ok) return null

    const data = await res.json()
    const pages = data.query?.pages
    if (!pages) return null

    const page = Object.values(pages)[0]
    const original = page?.original

    if (!original?.source) return null

    return {
      url: original.source,
      width: original.width,
      height: original.height,
      source: "wikipedia",
      articleTitle,
    }
  } catch {
    return null
  }
}

/**
 * Search Wikimedia Commons for images of a place.
 * Returns array of { url, thumbUrl, title, width, height, attribution }.
 */
async function searchCommonsImages(query, limit = 3) {
  try {
    // Search for files matching the query
    const searchParams = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: "6", // File namespace
      gsrlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata|mime",
      iiurlwidth: "800",
      format: "json",
      origin: "*",
    })

    const res = await fetch(`${COMMONS_API}?${searchParams}`, { headers: HEADERS })
    if (!res.ok) return []

    const data = await res.json()
    const pages = data.query?.pages
    if (!pages) return []

    return Object.values(pages)
      .filter((p) => {
        const info = p.imageinfo?.[0]
        if (!info) return false
        // Only JPEG/PNG, reasonable size
        if (!info.mime?.startsWith("image/")) return false
        if (info.width < 600 || info.height < 400) return false
        return true
      })
      .map((p) => {
        const info = p.imageinfo[0]
        const meta = info.extmetadata ?? {}
        return {
          url: info.url,
          thumbUrl: info.thumburl,
          width: info.width,
          height: info.height,
          title: p.title?.replace("File:", ""),
          attribution: meta.Artist?.value?.replace(/<[^>]+>/g, "") ?? "Unknown",
          license: meta.LicenseShortName?.value ?? "CC",
          description: meta.ImageDescription?.value?.replace(/<[^>]+>/g, "")?.slice(0, 200) ?? "",
          source: "commons",
        }
      })
  } catch {
    return []
  }
}

/**
 * Get the best photo for a POI: try Wikipedia main image first, then Commons search.
 */
async function getBestPhoto(poiName) {
  // Try Wikipedia article image first (usually the best curated one)
  const wikiImg = await getWikiMainImage(poiName)
  if (wikiImg) return { ...wikiImg, method: "wikipedia_main" }

  await sleep(300)

  // Fallback: search Commons
  const commonsResults = await searchCommonsImages(poiName, 1)
  if (commonsResults.length > 0) return { ...commonsResults[0], method: "commons_search" }

  return null
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2)
  const doDownload = args.includes("--download")
  const outputDir = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : "./data/photos"

  console.log("🌍 Viaje360 — Destination Photo Database Builder")
  console.log(`   Output: ${outputDir}`)
  console.log(`   Download images: ${doDownload}`)
  console.log(`   Destinations: ${TIER_1.length}`)
  console.log("")

  // Ensure output directories exist
  await mkdir(path.join(outputDir, "metadata"), { recursive: true })
  if (doDownload) {
    await mkdir(path.join(outputDir, "images"), { recursive: true })
  }

  const database = []
  let totalPhotos = 0
  let errors = 0

  for (const dest of TIER_1) {
    console.log(`\n📍 ${dest.city}, ${dest.country} (wiki: ${dest.wiki})`)

    const entry = {
      city: dest.city,
      country: dest.country,
      wiki: dest.wiki,
      hero: null,
      pois: [],
    }

    // Hero image — from the city's Wikipedia article
    console.log("   🏙️  Hero image...")
    const heroImg = await getBestPhoto(dest.wiki)
    if (heroImg) {
      entry.hero = heroImg
      totalPhotos++
      console.log(`   ✅ Hero: ${heroImg.url?.slice(0, 80)}...`)
    } else {
      console.log("   ❌ No hero image found")
      errors++
    }

    await sleep(500)

    // POI images
    for (const poi of dest.pois) {
      console.log(`   📸 ${poi}...`)
      const photo = await getBestPhoto(poi)
      if (photo) {
        entry.pois.push({ name: poi, photo })
        totalPhotos++
        console.log(`   ✅ ${photo.method}: ${photo.url?.slice(0, 60)}...`)
      } else {
        entry.pois.push({ name: poi, photo: null })
        console.log(`   ❌ No photo found`)
        errors++
      }

      // Rate limiting: ~2 requests per second
      await sleep(500)
    }

    database.push(entry)

    // Save per-city metadata as we go (in case of interruption)
    const cityFile = path.join(outputDir, "metadata", `${dest.wiki.toLowerCase().replace(/\s+/g, "-")}.json`)
    await writeFile(cityFile, JSON.stringify(entry, null, 2))

    // Download images if requested
    if (doDownload) {
      const cityDir = path.join(outputDir, "images", dest.wiki.toLowerCase().replace(/\s+/g, "-"))
      await mkdir(cityDir, { recursive: true })

      // Download hero
      if (entry.hero?.url) {
        await downloadImage(entry.hero.url, path.join(cityDir, "hero.jpg"))
      }

      // Download POIs
      for (const poi of entry.pois) {
        if (poi.photo?.url) {
          const filename = poi.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + ".jpg"
          await downloadImage(poi.photo.url || poi.photo.thumbUrl, path.join(cityDir, filename))
          await sleep(300)
        }
      }
    }
  }

  // Save complete database
  const dbFile = path.join(outputDir, "metadata", "destinations-photos.json")
  await writeFile(dbFile, JSON.stringify(database, null, 2))

  console.log("\n" + "=".repeat(50))
  console.log(`✅ Done! ${totalPhotos} photos found across ${TIER_1.length} destinations`)
  console.log(`❌ ${errors} missing photos`)
  console.log(`📁 Database: ${dbFile}`)
  console.log("=".repeat(50))
}

async function downloadImage(url, filepath) {
  if (existsSync(filepath)) return
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeFile(filepath, buffer)
  } catch (err) {
    console.error(`   ⚠️  Download failed: ${err.message}`)
  }
}

main().catch(console.error)
