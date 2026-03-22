import { getFeatureFlag } from "@/lib/feature-flags"

export interface WeatherData {
  temp: number
  condition: string
  icon: string
  humidity: number
  wind: number
}

export interface HourlyForecast {
  time: string
  temp: number
  condition: string
  precipitation: number
}

export interface DailyForecast {
  date: string
  maxTemp: number
  minTemp: number
  condition: string
  precipitation: number
}

const WMO_CODES: Record<number, { condition: string; icon: string }> = {
  0: { condition: "Despejado", icon: "sunny" },
  1: { condition: "Mayormente despejado", icon: "partly_cloudy_day" },
  2: { condition: "Parcialmente nublado", icon: "partly_cloudy_day" },
  3: { condition: "Nublado", icon: "cloud" },
  45: { condition: "Niebla", icon: "foggy" },
  48: { condition: "Niebla con escarcha", icon: "foggy" },
  51: { condition: "Llovizna ligera", icon: "rainy" },
  53: { condition: "Llovizna moderada", icon: "rainy" },
  55: { condition: "Llovizna intensa", icon: "rainy" },
  61: { condition: "Lluvia ligera", icon: "rainy" },
  63: { condition: "Lluvia moderada", icon: "rainy" },
  65: { condition: "Lluvia intensa", icon: "rainy" },
  71: { condition: "Nieve ligera", icon: "weather_snowy" },
  73: { condition: "Nieve moderada", icon: "weather_snowy" },
  75: { condition: "Nieve intensa", icon: "weather_snowy" },
  80: { condition: "Chubascos ligeros", icon: "rainy" },
  81: { condition: "Chubascos moderados", icon: "rainy" },
  82: { condition: "Chubascos intensos", icon: "thunderstorm" },
  95: { condition: "Tormenta", icon: "thunderstorm" },
  96: { condition: "Tormenta con granizo", icon: "thunderstorm" },
  99: { condition: "Tormenta fuerte con granizo", icon: "thunderstorm" },
}

function decodeWMO(code: number): { condition: string; icon: string } {
  return WMO_CODES[code] ?? { condition: "Variable", icon: "partly_cloudy_day" }
}

function isWeatherProviderEnabled() {
  return getFeatureFlag("OPEN_METEO")
}

export async function getCurrentWeather(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  if (!isWeatherProviderEnabled()) return null

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast")
    url.searchParams.set("latitude", lat.toString())
    url.searchParams.set("longitude", lng.toString())
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code")
    url.searchParams.set("timezone", "auto")

    const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
    if (!res.ok) return null

    const data = (await res.json()) as {
      current: {
        temperature_2m: number
        relative_humidity_2m: number
        wind_speed_10m: number
        weather_code: number
      }
    }

    const { condition, icon } = decodeWMO(data.current.weather_code)
    return {
      temp: Math.round(data.current.temperature_2m),
      condition,
      icon,
      humidity: data.current.relative_humidity_2m,
      wind: Math.round(data.current.wind_speed_10m),
    }
  } catch (err) {
    console.error("getCurrentWeather error:", err)
    return null
  }
}

export async function getForecast(
  lat: number,
  lng: number,
  days: number = 7
): Promise<{ hourly: HourlyForecast[]; daily: DailyForecast[] }> {
  if (!isWeatherProviderEnabled()) return { hourly: [], daily: [] }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast")
    url.searchParams.set("latitude", lat.toString())
    url.searchParams.set("longitude", lng.toString())
    url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability")
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum")
    url.searchParams.set("forecast_days", days.toString())
    url.searchParams.set("timezone", "auto")

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!res.ok) return { hourly: [], daily: [] }

    const data = (await res.json()) as {
      hourly: {
        time: string[]
        temperature_2m: number[]
        weather_code: number[]
        precipitation_probability: number[]
      }
      daily: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        weather_code: number[]
        precipitation_sum: number[]
      }
    }

    const hourly: HourlyForecast[] = data.hourly.time.slice(0, 24).map((time, i) => ({
      time,
      temp: Math.round(data.hourly.temperature_2m[i]),
      condition: decodeWMO(data.hourly.weather_code[i]).condition,
      precipitation: data.hourly.precipitation_probability[i] ?? 0,
    }))

    const daily: DailyForecast[] = data.daily.time.map((date, i) => ({
      date,
      maxTemp: Math.round(data.daily.temperature_2m_max[i]),
      minTemp: Math.round(data.daily.temperature_2m_min[i]),
      condition: decodeWMO(data.daily.weather_code[i]).condition,
      precipitation: data.daily.precipitation_sum[i] ?? 0,
    }))

    return { hourly, daily }
  } catch (err) {
    console.error("getForecast error:", err)
    return { hourly: [], daily: [] }
  }
}

export function shouldAdaptItinerary(
  weather: WeatherData,
  preferences: { weatherAdaptation: boolean }
): boolean {
  if (!preferences.weatherAdaptation) return false
  const badConditions = ["Lluvia intensa", "Tormenta", "Tormenta con granizo", "Tormenta fuerte con granizo", "Chubascos intensos"]
  return badConditions.includes(weather.condition) || weather.wind > 50
}
