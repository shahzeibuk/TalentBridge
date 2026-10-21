export class ApiError extends Error {
  status: number
  details: Record<string, unknown> | null

  constructor(message: string, status: number, details: Record<string, unknown> | null = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(
      "We couldn't reach TalentBridge. Check your connection and try again.",
      0,
    )
  }

  if (response.status === 413) {
    throw new ApiError(
      "This upload is too large for the host. Vercel rejects request bodies around 4.5 MB. Use a PDF or DOCX under 4 MB.",
      413,
    )
  }

  const payload = (await response.json().catch(() => null)) as ({ error?: string } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new ApiError(payload?.error || "Something went wrong. Try again.", response.status, payload)
  }
  return payload as T
}
