export function appOrigin(request?: Request) {
  const configured = process.env.AUTH_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")
  if (request) return new URL(request.url).origin
  return "http://127.0.0.1:3847"
}
