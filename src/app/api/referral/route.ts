import { NextRequest } from "next/server"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { normalizeRouteError, parseJsonBody, successResponse, errorResponse } from "@/lib/api/route-helpers"
import { resolveRequestIdentity } from "@/lib/auth/server"
import { createServiceClient } from "@/lib/supabase/server"
import crypto from "crypto"

const referralSchema = z.object({
  action: z.enum(["generate", "redeem"]),
  code: z.string().optional(),
})

function generateReferralCode(): string {
  return `V360-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, "referral", 10, "1 h")
  if (!rl.ok) return rl.response!

  try {
    const body = await parseJsonBody(req, referralSchema)
    const identity = await resolveRequestIdentity()
    if (!identity.userId) {
      return errorResponse("UNAUTHORIZED", "Inicia sesión para usar referidos", 401)
    }

    const supabase = createServiceClient()

    if (body.action === "generate") {
      // Check if user already has a code
      const { data: existing } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", identity.userId)
        .maybeSingle()

      if (existing) {
        return successResponse({ code: existing.code })
      }

      const code = generateReferralCode()
      await supabase.from("referral_codes").insert({
        user_id: identity.userId,
        code,
        uses: 0,
        max_uses: 10,
      })

      return successResponse({ code })
    }

    if (body.action === "redeem") {
      if (!body.code) return errorResponse("VALIDATION_ERROR", "Código requerido", 400)

      // Find the referral code
      const { data: referral } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("code", body.code.toUpperCase())
        .maybeSingle()

      if (!referral) return errorResponse("NOT_FOUND", "Código no válido", 404)
      if (referral.user_id === identity.userId) {
        return errorResponse("VALIDATION_ERROR", "No puedes usar tu propio código", 400)
      }
      if (referral.uses >= referral.max_uses) {
        return errorResponse("VALIDATION_ERROR", "Este código ya alcanzó su límite", 400)
      }

      // Check if already redeemed
      const { data: alreadyRedeemed } = await supabase
        .from("referral_redemptions")
        .select("id")
        .eq("referral_code_id", referral.id)
        .eq("redeemed_by", identity.userId)
        .maybeSingle()

      if (alreadyRedeemed) {
        return errorResponse("VALIDATION_ERROR", "Ya has usado este código", 400)
      }

      // Redeem: both get a free destination
      await supabase.from("referral_redemptions").insert({
        referral_code_id: referral.id,
        redeemed_by: identity.userId,
        referred_by: referral.user_id,
      })

      // Increment uses
      await supabase
        .from("referral_codes")
        .update({ uses: referral.uses + 1 })
        .eq("id", referral.id)

      return successResponse({ redeemed: true, message: "¡Código canjeado! Ambos recibís un destino gratis." })
    }

    return errorResponse("VALIDATION_ERROR", "Acción no válida", 400)
  } catch (error) {
    return normalizeRouteError(error, "Referral error")
  }
}
