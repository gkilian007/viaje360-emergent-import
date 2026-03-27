import { Resend } from "resend"

let resendClient: Resend | null = null

function isResendConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY
  return !!apiKey && apiKey !== "placeholder"
}

function getResendClient(): Resend | null {
  if (!isResendConfigured()) return null
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY!)
  }
  return resendClient
}

const FROM_EMAIL = "Viaje360 <noreply@viaje360.app>"

/**
 * Base email sender — fail gracefully (never throws to caller).
 * When RESEND_API_KEY is not configured, logs the attempt and returns false.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const resend = getResendClient()

  if (!resend) {
    console.warn(
      `[email.service] RESEND_API_KEY not configured — skipping email to ${to} (subject: "${subject}")`
    )
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
    if (error) {
      console.error("[email.service] Resend error:", error)
      return false
    }
    return true
  } catch (err) {
    console.error("[email.service] Failed to send email:", err)
    return false
  }
}

// ──────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<boolean> {
  const subject = "¡Bienvenido a Viaje360! 🌍"
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0A84FF,#5E5CE6);padding:40px 40px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">🌍 Viaje360</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Tu planificador de viajes con IA</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#fff;font-size:22px;">¡Hola, ${name}! 👋</h2>
              <p style="margin:0 0 16px;color:#c0c6d6;font-size:16px;line-height:1.6;">
                Bienvenido a Viaje360. Estamos encantados de tenerte con nosotros.
              </p>
              <p style="margin:0 0 24px;color:#c0c6d6;font-size:16px;line-height:1.6;">
                Con Viaje360 puedes planificar viajes personalizados en segundos, adaptados a tus gustos, ritmo y presupuesto — todo impulsado por inteligencia artificial.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="padding:8px 0;color:#c0c6d6;font-size:14px;">✅ &nbsp;Itinerarios día a día con IA</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#c0c6d6;font-size:14px;">🗺️ &nbsp;Mapas y rutas integrados</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#c0c6d6;font-size:14px;">🌤️ &nbsp;Adaptación en tiempo real al clima</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#c0c6d6;font-size:14px;">📖 &nbsp;Diario de viaje inteligente</td>
                </tr>
              </table>
              <div style="text-align:center;margin:32px 0;">
                <a href="https://viaje360.app/onboarding"
                   style="display:inline-block;background:linear-gradient(135deg,#0A84FF,#5E5CE6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;">
                  Planifica tu primer viaje →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#666;font-size:12px;">
                Viaje360 · <a href="https://viaje360.app" style="color:#0A84FF;text-decoration:none;">viaje360.app</a><br/>
                Si no creaste esta cuenta, ignora este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
  return sendEmail(to, subject, html)
}

export async function sendPaymentConfirmationEmail(
  to: string,
  name: string,
  plan: string,
  amount: string
): Promise<boolean> {
  const subject = "Pago confirmado — Viaje360 ✅"
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#30D158,#0A84FF);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">✅</div>
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Pago confirmado</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#fff;font-size:20px;">¡Gracias, ${name}!</h2>
              <p style="margin:0 0 24px;color:#c0c6d6;font-size:16px;line-height:1.6;">
                Tu suscripción a Viaje360 ha sido activada correctamente. Ya tienes acceso completo a todas las funcionalidades.
              </p>
              <!-- Receipt box -->
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin:24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#c0c6d6;font-size:14px;padding:8px 0;">Plan</td>
                    <td style="color:#fff;font-size:14px;font-weight:600;text-align:right;padding:8px 0;">${plan}</td>
                  </tr>
                  <tr>
                    <td style="border-top:1px solid rgba(255,255,255,0.06);color:#c0c6d6;font-size:14px;padding:12px 0 8px;">Importe</td>
                    <td style="border-top:1px solid rgba(255,255,255,0.06);color:#30D158;font-size:18px;font-weight:700;text-align:right;padding:12px 0 8px;">${amount}</td>
                  </tr>
                </table>
              </div>
              <div style="text-align:center;margin:32px 0;">
                <a href="https://viaje360.app/home"
                   style="display:inline-block;background:linear-gradient(135deg,#0A84FF,#5E5CE6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;">
                  Ir a Viaje360 →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#666;font-size:12px;">
                Viaje360 · <a href="https://viaje360.app" style="color:#0A84FF;text-decoration:none;">viaje360.app</a><br/>
                Para cualquier duda escríbenos a soporte@viaje360.app
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
  return sendEmail(to, subject, html)
}

export async function sendTrialExpiringEmail(
  to: string,
  name: string,
  daysLeft: number,
  destination: string
): Promise<boolean> {
  const subject = `Tu prueba gratuita expira en ${daysLeft} día${daysLeft === 1 ? "" : "s"} — Viaje360 ⏰`
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#FF9F0A,#FF375F);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:8px;">⏰</div>
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">
                Tu prueba expira en ${daysLeft} día${daysLeft === 1 ? "" : "s"}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#fff;font-size:20px;">Hola, ${name}</h2>
              <p style="margin:0 0 16px;color:#c0c6d6;font-size:16px;line-height:1.6;">
                Tu periodo de prueba gratuita de Viaje360 está a punto de terminar.
                ${destination ? `Recuerda que tienes tu viaje a <strong style="color:#fff;">${destination}</strong> guardado y listo.` : ""}
              </p>
              <p style="margin:0 0 24px;color:#c0c6d6;font-size:16px;line-height:1.6;">
                Suscríbete ahora para seguir disfrutando de itinerarios ilimitados, adaptaciones en tiempo real y todas las funcionalidades premium.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="https://viaje360.app/pricing"
                   style="display:inline-block;background:linear-gradient(135deg,#FF9F0A,#FF375F);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;">
                  Ver planes →
                </a>
              </div>
              <p style="margin:0;color:#666;font-size:13px;text-align:center;">
                Si no deseas continuar, no necesitas hacer nada. Tu cuenta se revertirá al plan gratuito automáticamente.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#666;font-size:12px;">
                Viaje360 · <a href="https://viaje360.app" style="color:#0A84FF;text-decoration:none;">viaje360.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
  return sendEmail(to, subject, html)
}
