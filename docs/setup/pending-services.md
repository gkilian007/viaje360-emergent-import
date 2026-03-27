# Servicios externos pendientes de configurar

Viaje360 funciona completamente sin estas variables gracias a los fallbacks implementados,
pero configurarlas activa funcionalidades adicionales en producción.

---

## 1. Sentry — Error tracking

| Campo | Valor |
|-------|-------|
| **URL** | https://sentry.io/signup/ |
| **Plan** | Free (siempre gratis, 5 000 errores/mes) |
| **Tiempo de registro** | ~5 minutos |
| **Variable** | `NEXT_PUBLIC_SENTRY_DSN` |

### Pasos
1. Crear cuenta en sentry.io
2. **New Project** → seleccionar **Next.js**
3. Copiar el DSN (formato: `https://xxxxx@oXXX.ingest.sentry.io/XXXX`)
4. Ejecutar `bash scripts/setup-env.sh` o añadirlo manualmente en Vercel

### Qué activa
- Captura automática de errores en cliente, servidor y edge
- Alertas por email cuando algo falla en producción
- Stack traces con contexto del usuario y la sesión
- Performance monitoring con `tracesSampleRate: 0.1` (10% de requests)

---

## 2. Resend — Emails transaccionales

| Campo | Valor |
|-------|-------|
| **URL** | https://resend.com/signup |
| **Plan** | Free (3 000 emails/mes, 100/día) |
| **Tiempo de registro** | ~3 minutos |
| **Variable** | `RESEND_API_KEY` |

### Pasos
1. Crear cuenta en resend.com
2. Ir a **API Keys** → **Create API Key**
3. (Opcional) Verificar dominio `viaje360.app` para mejor deliverability
4. Copiar la API key (formato: `re_xxxxxxxx`)

### Qué activa
- Email de bienvenida al registrarse
- Confirmación de pago al suscribirse
- Aviso cuando el periodo de prueba está a punto de expirar

> Sin esta variable: los emails se loguean en consola pero no se envían. La app no crashea.

---

## 3. Upstash Redis — Rate limiting persistente

| Campo | Valor |
|-------|-------|
| **URL** | https://console.upstash.com/ |
| **Plan** | Free (10 000 req/día, 256 MB) |
| **Tiempo de registro** | ~5 minutos |
| **Variables** | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |

### Pasos
1. Crear cuenta en console.upstash.com
2. **Create Database** → nombre: `viaje360-ratelimit` → región: `eu-west-1` (Frankfurt)
3. En el panel de la DB → pestaña **REST API**
4. Copiar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`

### Qué activa
- Rate limiting persistente entre instancias serverless (Vercel tiene múltiples)
- Sliding window algorithm distribuido (más justo que ventana fija)
- Limits compartidos entre todos los pods del deploy

> Sin estas variables: rate limiting in-memory activo con estos límites:
> - `generate`: 5 requests/día por IP (por proceso)
> - `adapt`: 20 requests/día por IP (por proceso)
>
> **Nota:** In-memory se resetea por cada instancia serverless nueva. En producción con
> tráfico bajo es suficiente; con tráfico alto, configurar Upstash.

---

## Setup rápido (todo a la vez)

```bash
bash scripts/setup-env.sh
```

El script guía paso a paso, configura las variables en Vercel y hace redeploy automático.

---

## Estado actual de fallbacks

| Variable | Estado | Comportamiento sin ella |
|----------|--------|------------------------|
| `NEXT_PUBLIC_SENTRY_DSN` | `placeholder` | Sentry desactivado, no se envían errores |
| `RESEND_API_KEY` | `placeholder` | Emails loguean en consola, no se envían |
| `UPSTASH_REDIS_REST_URL` | no configurada | Rate limiting in-memory (5/20 req/día/IP) |
| `UPSTASH_REDIS_REST_TOKEN` | no configurada | Rate limiting in-memory (5/20 req/día/IP) |
