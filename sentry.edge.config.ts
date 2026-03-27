import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const sentryEnabled =
  process.env.NODE_ENV === "production" &&
  !!dsn &&
  dsn !== "placeholder"

Sentry.init({
  dsn: sentryEnabled ? dsn : undefined,
  tracesSampleRate: 0.1,
  enabled: sentryEnabled,
})
