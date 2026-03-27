import { requireEnv } from "@/lib/env"

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

const BASE_SYSTEM_PROMPT =
  "Eres Viaje360, el asistente de viaje personal del usuario. Das consejos de viaje útiles, personalizados y detallados. Cuando te pregunten por restaurantes, actividades, rutas, clima o cultura local, da respuestas concretas con nombres reales, horarios, precios aproximados y consejos prácticos. Usa listas cuando ayude a la claridad. Sé cálido y entusiasta, como un amigo experto en viajes. Responde siempre en el mismo idioma que el usuario."

interface GeminiPart {
  text: string
}

interface GeminiContent {
  role: "user" | "model"
  parts: GeminiPart[]
}

interface GeminiRequest {
  contents: GeminiContent[]
  systemInstruction?: { parts: GeminiPart[] }
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
  }
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: GeminiPart[]
      role: string
    }
    finishReason: string
  }>
}

export async function generateChatResponse(
  history: Array<{ role: "user" | "model"; text: string }>,
  userMessage: string,
  extraContext?: string
): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY", "Gemini API")

  const systemPrompt = extraContext
    ? `${BASE_SYSTEM_PROMPT}\n\n${extraContext}`
    : BASE_SYSTEM_PROMPT

  const contents: GeminiContent[] = [
    ...history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ]

  const body: GeminiRequest = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data: GeminiResponse = await res.json()
  return data.candidates[0]?.content?.parts[0]?.text ?? "No response"
}

export async function generateQuizQuestion(destination: string): Promise<string> {
  const apiKey = requireEnv("GEMINI_API_KEY", "Gemini API")

  const prompt = `Generate a travel/culture trivia question about ${destination}.
Return ONLY valid JSON in this exact format, no markdown:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "funFact": "A brief interesting fact related to the answer.",
  "xpReward": 50
}`

  const body: GeminiRequest = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
  }

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data: GeminiResponse = await res.json()
  return data.candidates[0]?.content?.parts[0]?.text ?? "{}"
}
