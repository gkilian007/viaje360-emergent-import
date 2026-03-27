import type { DayWeather } from "@/lib/weather-utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivitySnapshot {
  id: string
  name: string
  type: string
  time: string
  endTime: string
  duration: number
}

export interface DaySnapshot {
  dayNumber: number
  date: string
  activities: ActivitySnapshot[]
  weather: DayWeather | null
}

export type IssueSeverity = "critical" | "warning" | "info"
export type IssueKind = "rain" | "storm" | "heat" | "cold" | "fatigue" | "overcrowded"

export interface TripIssue {
  kind: IssueKind
  severity: IssueSeverity
  dayNumber: number
  title: string
  description: string
  emoji: string
  /** Activity IDs directly affected */
  affectedActivityIds?: string[]
  /** Suggested adaptation prompt to send to the AI */
  adaptationPrompt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTDOOR_TYPES = new Set(["outdoor", "playa", "aventura", "deportes", "naturaleza"])
const HEAVY_PHYSICAL_TYPES = new Set(["aventura", "deportes"])
const SEVERITY_ORDER: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 }

// ─── Detection functions ──────────────────────────────────────────────────────

function detectRainIssues(day: DaySnapshot): TripIssue[] {
  if (!day.weather) return []
  const { precipitationProbability, weatherCode, tempMax, tempMin } = day.weather
  const isStorm = weatherCode >= 95
  const isHeavyRain = precipitationProbability >= 60

  const issues: TripIssue[] = []
  const outdoorActivities = day.activities.filter(a => OUTDOOR_TYPES.has(a.type))

  if (isStorm && precipitationProbability >= 60) {
    issues.push({
      kind: "storm",
      severity: "critical",
      dayNumber: day.dayNumber,
      emoji: "⛈️",
      title: "Tormenta prevista",
      description: `Se esperan tormentas con ${precipitationProbability}% de probabilidad. ${tempMin}°—${tempMax}°C.`,
      affectedActivityIds: outdoorActivities.map(a => a.id),
      adaptationPrompt: `Tormenta severa prevista para el día ${day.dayNumber} (${precipitationProbability}% probabilidad, código meteorológico ${weatherCode}). Es urgente: mueve TODAS las actividades al aire libre a días con mejor tiempo, sustitúyelas por museos, restaurantes de calidad, actividades cubiertas. Si no hay otros días disponibles, encuentra alternativas interiores en la misma zona.`,
    })
  } else if (isHeavyRain && outdoorActivities.length > 0) {
    issues.push({
      kind: "rain",
      severity: "warning",
      dayNumber: day.dayNumber,
      emoji: "🌧️",
      title: "Lluvia probable",
      description: `${precipitationProbability}% de lluvia para el día ${day.dayNumber}. Tienes ${outdoorActivities.length} actividad${outdoorActivities.length > 1 ? "es" : ""} al aire libre.`,
      affectedActivityIds: outdoorActivities.map(a => a.id),
      adaptationPrompt: `Lluvia probable para el día ${day.dayNumber} (${precipitationProbability}% de probabilidad). Sustituye las actividades al aire libre por alternativas cubiertas igualmente interesantes: museos, galerías, mercados cubiertos, talleres, restaurantes especiales. Mantén el espíritu del día pero adaptado al interior.`,
    })
  }

  return issues
}

function detectTemperatureIssues(day: DaySnapshot): TripIssue[] {
  if (!day.weather) return []
  const { tempMax, tempMin, weatherCode, precipitationProbability, date } = day.weather
  const issues: TripIssue[] = []

  // Heat advisory: >36°C with outdoor activities at midday
  if (tempMax >= 36) {
    const middayOutdoor = day.activities.filter(a => {
      if (!OUTDOOR_TYPES.has(a.type)) return false
      const hour = parseInt(a.time.split(":")[0])
      return hour >= 11 && hour <= 16
    })
    if (middayOutdoor.length > 0) {
      issues.push({
        kind: "heat",
        severity: "warning",
        dayNumber: day.dayNumber,
        emoji: "🥵",
        title: "Calor extremo",
        description: `${tempMax}°C esperados el día ${day.dayNumber}. Actividades al aire libre a mediodía pueden ser agotadoras.`,
        affectedActivityIds: middayOutdoor.map(a => a.id),
        adaptationPrompt: `Ola de calor el día ${day.dayNumber}: ${tempMax}°C. Mueve las actividades al aire libre de mediodía (11:00–16:00) a primera mañana (antes de las 10:00) o tarde-noche (después de las 18:00). Añade una parada en cafetería o espacio con aire acondicionado a mediodía. Si hay playas o piscinas, sugiere ese momento para el descanso acuático.`,
      })
    }
  }

  // Cold advisory: <2°C with beach or light outdoor activities
  if (tempMax <= 2) {
    const coldSensitiveActivities = day.activities.filter(a =>
      a.type === "playa" || a.type === "outdoor" || a.type === "naturaleza"
    )
    if (coldSensitiveActivities.length > 0) {
      issues.push({
        kind: "cold",
        severity: "warning",
        dayNumber: day.dayNumber,
        emoji: "🥶",
        title: "Temperatura muy baja",
        description: `Solo ${tempMax}°C el día ${day.dayNumber}. Algunas actividades planificadas requieren reconsideración.`,
        affectedActivityIds: coldSensitiveActivities.map(a => a.id),
        adaptationPrompt: `Frío extremo el día ${day.dayNumber}: máxima de ${tempMax}°C. Sustituye actividades de playa o naturaleza ligera por alternativas de interior atractivas: museos temáticos, mercados navideños si aplica, gastronomía local en interiores cálidos, termas o spas si hay en la zona. Mantén el espíritu explorador pero protegido del frío.`,
      })
    }
  }

  return issues
}

function detectFatigueIssues(day: DaySnapshot): TripIssue[] {
  const issues: TripIssue[] = []
  const activities = day.activities

  if (activities.length < 4) return []

  // Check if last 2 activities of the day are heavy physical
  const lastTwo = activities.slice(-2)
  const heavyAtEnd = lastTwo.filter(a => HEAVY_PHYSICAL_TYPES.has(a.type))

  if (heavyAtEnd.length >= 1) {
    issues.push({
      kind: "fatigue",
      severity: "info",
      dayNumber: day.dayNumber,
      emoji: "😴",
      title: "Día intenso",
      description: `El día ${day.dayNumber} tiene ${activities.length} actividades, terminando con actividades físicamente exigentes.`,
      affectedActivityIds: heavyAtEnd.map(a => a.id),
      adaptationPrompt: `El día ${day.dayNumber} es muy intenso: ${activities.length} actividades con ejercicio físico al final del día. Reorganiza para que las actividades físicas exigentes sean por la mañana cuando hay más energía, y cierra el día con algo más relajado: una cena especial, un paseo tranquilo, o una actividad cultural sedentaria. Si alguna actividad es prescindible, elimínala para dar más espacio a disfrutar sin prisa.`,
    })
  }

  return issues
}

// ─── Main detection engine ────────────────────────────────────────────────────

export function detectTripIssues(days: DaySnapshot[]): TripIssue[] {
  const allIssues: TripIssue[] = []

  for (const day of days) {
    allIssues.push(...detectRainIssues(day))
    allIssues.push(...detectTemperatureIssues(day))
    allIssues.push(...detectFatigueIssues(day))
  }

  // Sort: critical first, then warning, then info; within same severity, earlier days first
  return allIssues.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff
    return a.dayNumber - b.dayNumber
  })
}

// ─── Helper: map from app DayItinerary types ──────────────────────────────────

import type { DayItinerary, TimelineActivity } from "@/lib/types"

export function itineraryToDaySnapshots(
  itinerary: DayItinerary[],
  getWeatherForDate: (date: string) => DayWeather | undefined
): DaySnapshot[] {
  return itinerary.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    activities: day.activities.map((a: TimelineActivity) => ({
      id: a.id,
      name: a.name,
      type: a.type ?? "cultural",
      time: a.time ?? "09:00",
      endTime: a.endTime ?? "11:00",
      duration: a.duration ?? 90,
    })),
    weather: getWeatherForDate(day.date) ?? null,
  }))
}
