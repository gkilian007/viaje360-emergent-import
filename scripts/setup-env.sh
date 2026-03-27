#!/bin/bash
# Viaje360 — Setup interactivo de variables de entorno pendientes
# Configura las 4 variables en Vercel y hace redeploy automático.

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Viaje360 — Setup de servicios externos   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "Este script configura las variables de entorno pendientes en Vercel."
echo "Todos los servicios tienen plan gratuito."
echo ""

# ──────────────────────────────────────────────
# 1. Sentry
# ──────────────────────────────────────────────
echo -e "${YELLOW}1. Sentry — Error tracking (gratis)${NC}"
echo "   → https://sentry.io/signup/"
echo "   Crea una cuenta → New Project → Next.js → copia el DSN"
echo ""
read -p "   NEXT_PUBLIC_SENTRY_DSN: " SENTRY_DSN

if [ -n "$SENTRY_DSN" ] && [ "$SENTRY_DSN" != "placeholder" ]; then
  echo "$SENTRY_DSN" | npx vercel env add NEXT_PUBLIC_SENTRY_DSN production
  echo "$SENTRY_DSN" | npx vercel env add NEXT_PUBLIC_SENTRY_DSN preview
  echo -e "   ${GREEN}✅ Sentry configurado${NC}"
else
  echo "   ⏭️  Saltando Sentry..."
fi
echo ""

# ──────────────────────────────────────────────
# 2. Resend
# ──────────────────────────────────────────────
echo -e "${YELLOW}2. Resend — Emails transaccionales (gratis, 3 000 emails/mes)${NC}"
echo "   → https://resend.com/signup"
echo "   Crea una cuenta → API Keys → Create API Key"
echo ""
read -p "   RESEND_API_KEY: " RESEND_KEY

if [ -n "$RESEND_KEY" ] && [ "$RESEND_KEY" != "placeholder" ]; then
  echo "$RESEND_KEY" | npx vercel env add RESEND_API_KEY production
  echo "$RESEND_KEY" | npx vercel env add RESEND_API_KEY preview
  echo -e "   ${GREEN}✅ Resend configurado${NC}"
else
  echo "   ⏭️  Saltando Resend..."
fi
echo ""

# ──────────────────────────────────────────────
# 3. Upstash Redis
# ──────────────────────────────────────────────
echo -e "${YELLOW}3. Upstash Redis — Rate limiting (gratis, 10 000 req/día)${NC}"
echo "   → https://console.upstash.com/"
echo "   Create Database → elige región → REST API → copia URL y Token"
echo ""
read -p "   UPSTASH_REDIS_REST_URL: " UPSTASH_URL
read -p "   UPSTASH_REDIS_REST_TOKEN: " UPSTASH_TOKEN

if [ -n "$UPSTASH_URL" ] && [ -n "$UPSTASH_TOKEN" ]; then
  echo "$UPSTASH_URL" | npx vercel env add UPSTASH_REDIS_REST_URL production
  echo "$UPSTASH_URL" | npx vercel env add UPSTASH_REDIS_REST_URL preview
  echo "$UPSTASH_TOKEN" | npx vercel env add UPSTASH_REDIS_REST_TOKEN production
  echo "$UPSTASH_TOKEN" | npx vercel env add UPSTASH_REDIS_REST_TOKEN preview
  echo -e "   ${GREEN}✅ Upstash Redis configurado${NC}"
else
  echo "   ⏭️  Saltando Upstash..."
fi
echo ""

# ──────────────────────────────────────────────
# Deploy
# ──────────────────────────────────────────────
echo -e "${GREEN}✅ Variables configuradas. Iniciando redeploy a producción...${NC}"
echo ""
npx vercel --prod

echo ""
echo -e "${GREEN}🚀 ¡Listo! Viaje360 está desplegado con todos los servicios activos.${NC}"
