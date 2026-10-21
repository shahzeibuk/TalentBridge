import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"

export class ScrapeError extends Error {
  partial: { title: string; company: string; description: string }

  constructor(message: string, partial?: { title: string; company: string; description: string }) {
    super(message)
    this.name = "ScrapeError"
    this.partial = partial ?? { title: "", company: "", description: "" }
  }
}

const BLOCKED = new Set([401, 403, 407, 429, 451, 503])

export function isPrivateAddress(address: string): boolean {
  const raw = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]
  if (isIP(raw) === 0) return false
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const ip = mapped?.[1] ?? raw
  if (ip.includes(".")) {
    const parts = ip.split(".").map((part) => Number(part))
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
    const [a, b] = parts
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && (b === 168 || b === 0)) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
    return false
  }
  if (ip === "::1" || ip === "::") return true
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true
  if (/^fe[89ab]/.test(ip)) return true
  return false
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  )
}

type PageResult = { status: number; headers: Record<string, string>; body: string }

async function fetchPinned(url: URL, ip: string): Promise<PageResult> {
  const lib = url.protocol === "https:" ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const req = lib(
      {
        host: ip,
        servername: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        method: "GET",
        path: `${url.pathname || "/"}${url.search}`,
        headers: {
          Host: url.host,
          "User-Agent": "TalentBridge/0.1 (job posting import)",
          Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          "Accept-Language": "en",
        },
        timeout: 12_000,
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on("data", (chunk: Buffer) => {
          size += chunk.length
          if (size > 1_500_000) {
            req.destroy()
            reject(new ScrapeError("That page is too large to read. Paste the job description instead."))
            return
          }
          chunks.push(chunk)
        })
        res.on("end", () => {
          const headers: Record<string, string> = {}
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") headers[key.toLowerCase()] = value
            else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(", ")
          }
          resolve({ status: res.statusCode || 0, headers, body: Buffer.concat(chunks).toString("utf8") })
        })
      },
    )
    req.on("timeout", () => {
      req.destroy()
      reject(new ScrapeError("The page took too long to answer. Paste the job description instead."))
    })
    req.on("error", () => {
      reject(new ScrapeError("The page didn't respond. Paste the job description instead."))
    })
    req.end()
  })
}

type LookupAll = (hostname: string, options: { all: true; verbatim: true }) => Promise<{ address: string }[]>

export async function assertPublicUrl(raw: string, lookupImpl: LookupAll = lookup) {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new ScrapeError("Enter a full job posting URL, including https://.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScrapeError("Use an http or https link to the job posting.")
  }
  if (url.username || url.password) throw new ScrapeError("That URL isn't a public job page. Paste the description instead.")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (blockedHost(host) || isPrivateAddress(host)) {
    throw new ScrapeError("That URL isn't a public job page. Paste the description instead.")
  }
  let addresses: { address: string }[]
  try {
    addresses = await lookupImpl(url.hostname, { all: true, verbatim: true })
  } catch {
    throw new ScrapeError("That host didn't resolve. Check the link, or paste the description instead.")
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ScrapeError("That URL isn't a public job page. Paste the description instead.")
  }
  return { url, ip: addresses[0].address }
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code)
      return n > 0 && n < 65536 ? String.fromCharCode(n) : ""
    })
}

function htmlToText(html: string) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h1|h2|h3|tr|section|article)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  )
}

function metaContent(html: string, key: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  )
  const match = html.match(pattern)
  return decode(match?.[1] || match?.[2] || "").trim()
}

function jsonLdNodes(html: string) {
  const nodes: Record<string, unknown>[] = []
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as unknown
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        if (!item || typeof item !== "object") continue
        const record = item as Record<string, unknown>
        if (Array.isArray(record["@graph"])) {
          for (const child of record["@graph"]) {
            if (child && typeof child === "object") nodes.push(child as Record<string, unknown>)
          }
        } else nodes.push(record)
      }
    } catch {
      continue
    }
  }
  return nodes
}

function typesOf(node: Record<string, unknown>) {
  const value = node["@type"]
  const list = Array.isArray(value) ? value : [value]
  return list.filter((item): item is string => typeof item === "string")
}

function orgName(value: unknown) {
  if (typeof value === "string") return value.trim()
  if (value && typeof value === "object" && "name" in value && typeof value.name === "string") return value.name.trim()
  return ""
}

export function extractJobPosting(html: string) {
  let title = ""
  let company = ""
  let description = ""
  for (const node of jsonLdNodes(html)) {
    if (!typesOf(node).some((type) => type.toLowerCase() === "jobposting")) continue
    if (!title && typeof node.title === "string") title = node.title.trim()
    if (!company) company = orgName(node.hiringOrganization)
    if (!description && typeof node.description === "string") description = htmlToText(node.description)
  }
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    title = htmlToText(h1?.[1] || "") || metaContent(html, "og:title")
  }
  if (!company) company = metaContent(html, "og:site_name")
  if (!description) {
    const main = html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)
    description = htmlToText(main?.[1] || html)
  }
  title = title.replace(/\s+/g, " ").trim()
  const split = title.match(/^(.*?)\s+at\s+([^|–—-]+)$/i)
  if (split && !company) {
    title = split[1].trim()
    company = split[2].trim()
  }
  title = title.replace(/\s+[|\-–—]\s+[^|\-–—]+$/, "").trim()
  return {
    title: title.slice(0, 160),
    company: company.replace(/\s+/g, " ").trim().slice(0, 160),
    description: description.slice(0, 40_000),
  }
}

function looksBlocked(text: string) {
  return /access denied|just a moment|enable javascript|captcha|are you a robot|request blocked/i.test(text.slice(0, 500))
}

export async function scrapeJobUrl(
  raw: string,
  deps?: { lookupImpl?: LookupAll; fetchPage?: (url: URL, ip: string) => Promise<PageResult> },
) {
  let current = raw.trim()
  const fetchPage = deps?.fetchPage ?? fetchPinned
  for (let hop = 0; hop < 4; hop += 1) {
    const { url, ip } = await assertPublicUrl(current, deps?.lookupImpl)
    const page = await fetchPage(url, ip)
    if (page.status >= 300 && page.status < 400 && page.headers.location) {
      current = new URL(page.headers.location, url).toString()
      continue
    }
    if (BLOCKED.has(page.status)) {
      throw new ScrapeError(
        `That site blocked the fetch (${page.status}). Paste the job title, company, and description instead.`,
      )
    }
    if (page.status < 200 || page.status >= 300) {
      throw new ScrapeError(`The page returned ${page.status}. Paste the job description instead.`)
    }
    const contentType = page.headers["content-type"] || ""
    if (contentType && !/html|text\/plain|xml/i.test(contentType)) {
      throw new ScrapeError("That page isn't readable text. Paste the job description instead.")
    }
    const extracted = extractJobPosting(page.body)
    if (extracted.description.length < 80 || looksBlocked(extracted.description) || !extracted.title) {
      throw new ScrapeError(
        "The page didn't include a job description we could read. Paste the title, company, and description instead.",
        extracted,
      )
    }
    if (!extracted.company) {
      throw new ScrapeError("The page didn't include a company name. Add it below, along with anything else to correct.", extracted)
    }
    return extracted
  }
  throw new ScrapeError("That link redirected too many times. Paste the job description instead.")
}
