import { looseResumeData, type ResumeData } from "@/lib/resume-data"

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"

const DATE_TOKEN = `(?:${MONTH}\\.?\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`

function rangePattern() {
  return new RegExp(
    `(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${DATE_TOKEN}|present|current|now)`,
    "i",
  )
}

const HEADINGS: Record<string, "experience" | "education" | "skills"> = {
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "work history": "experience",
  education: "education",
  "academic background": "education",
  skills: "skills",
  "technical skills": "skills",
  "core skills": "skills",
  "core competencies": "skills",
}

function sectionName(line: string) {
  const cleaned = line.trim().replace(/[:\s]+$/g, "").toLowerCase()
  return HEADINGS[cleaned] ?? null
}

function looksLikeProse(line: string) {
  return /[.!?]\s/.test(line) || (line.endsWith(".") && line.length > 40)
}

function parseRange(line: string) {
  const match = line.match(rangePattern())
  if (match) return { start: match[1], end: match[2] }
  const loose = line.match(new RegExp(`^(${DATE_TOKEN})\\s+(${DATE_TOKEN}|present|current|now)$`, "i"))
  if (!loose) return null
  return { start: loose[1], end: loose[2] }
}

function isRange(line: string) {
  return parseRange(line) !== null
}

function entriesFrom(lines: string[]) {
  const clean = lines.map((line) => line.trim()).filter(Boolean)
  const entries: { roleLines: string[]; start: string; end: string; description: string }[] = []
  let index = 0

  while (index < clean.length) {
    let dateIndex = -1
    for (let cursor = index; cursor < Math.min(index + 3, clean.length); cursor += 1) {
      if (isRange(clean[cursor])) {
        dateIndex = cursor
        break
      }
    }

    if (dateIndex === -1) {
      if (entries.length > 0) {
        const previous = entries[entries.length - 1]
        previous.description = [previous.description, clean[index]].filter(Boolean).join("\n")
      }
      index += 1
      continue
    }

    const roleLines = clean.slice(index, dateIndex)
    const range = parseRange(clean[dateIndex]) ?? { start: "", end: "" }
    index = dateIndex + 1
    const description: string[] = []

    while (index < clean.length) {
      const nextDateOffset = [1, 2].find(
        (offset) => index + offset < clean.length && isRange(clean[index + offset]),
      )
      if (
        nextDateOffset &&
        clean[index].length < 120 &&
        !isRange(clean[index]) &&
        !looksLikeProse(clean[index]) &&
        (nextDateOffset === 1 || !looksLikeProse(clean[index + 1] ?? ""))
      ) {
        break
      }
      if (isRange(clean[index]) && description.length > 0) break
      description.push(clean[index])
      index += 1
    }

    entries.push({
      roleLines,
      start: range.start,
      end: range.end,
      description: description.join("\n"),
    })
  }

  return entries
}

function splitRole(line: string) {
  const patterns = [/\s+[—–]\s+/, /\s+-\s+/, /\s+at\s+/i, /\s+\|\s+/]
  for (const pattern of patterns) {
    const parts = line.split(pattern)
    if (
      parts.length === 2 &&
      parts[0].trim() &&
      parts[1].trim() &&
      parts[0].trim().length < 120 &&
      parts[1].trim().length < 120
    ) {
      return { company: parts[0].trim(), title: parts[1].trim() }
    }
  }
  return null
}

function roleFields(roleLines: string[]) {
  if (roleLines.length === 0) return { company: "", title: "", extra: "" }
  const split = splitRole(roleLines[0])
  if (split) {
    return {
      company: split.company,
      title: split.title,
      extra: roleLines.slice(1).join("\n"),
    }
  }
  if (roleLines.length >= 2) {
    return {
      company: roleLines[0],
      title: roleLines[1],
      extra: roleLines.slice(2).join("\n"),
    }
  }
  return { company: "", title: roleLines[0], extra: "" }
}

function collectLinks(text: string) {
  const links = new Set<string>()
  const patterns = [/https?:\/\/[^\s)]+/gi, /(?:linkedin\.com|github\.com)\/[^\s)]+/gi]
  for (const pattern of patterns) {
    for (const match of text.match(pattern) ?? []) {
      links.add(match.replace(/[.,);]+$/g, ""))
    }
  }
  return [...links]
}

export function fallbackExtract(text: string): ResumeData {
  const normalized = text.replace(/\r\n/g, "\n")
  const buckets = {
    header: [] as string[],
    experience: [] as string[],
    education: [] as string[],
    skills: [] as string[],
  }
  let current: keyof typeof buckets = "header"

  for (const rawLine of normalized.split("\n")) {
    const trimmed = rawLine.trim()
    const heading = sectionName(trimmed)
    if (heading) {
      current = heading
      continue
    }
    buckets[current].push(trimmed)
  }

  const headerParts = buckets.header
    .join("\n")
    .split(/\n|\||•|·/)
    .map((part) => part.trim())
    .filter(Boolean)

  const emailMatch = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = normalized.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/)
  const email = emailMatch?.[0] ?? ""
  const phone = phoneMatch?.[0] ?? ""
  const links = collectLinks(normalized)

  const locationPart = headerParts.find((part) => {
    if (part.includes("@") || /https?:\/\//i.test(part) || part === phone) return false
    return /^[\p{L}][\p{L} .'-]*,\s*[\p{L}][\p{L} .'-]*$/u.test(part) && part.length < 80
  })

  const fullName =
    headerParts.find((part) => {
      if (part === email || part === phone || part === locationPart) return false
      if (part.includes("@") || /https?:\/\//i.test(part) || /linkedin\.com|github\.com/i.test(part)) return false
      return /[\p{L}]/u.test(part) && part.length >= 2 && part.length <= 80
    }) ?? ""

  const experience = entriesFrom(buckets.experience).map((entry) => {
    const role = roleFields(entry.roleLines)
    return {
      company: role.company,
      title: role.title,
      start: entry.start,
      end: entry.end,
      description: [role.extra, entry.description].filter(Boolean).join("\n"),
    }
  })

  const education = entriesFrom(buckets.education).map((entry) => {
    const school = entry.roleLines[0] ?? ""
    const degreeLine = entry.roleLines[1] ?? ""
    const [degree = "", ...fieldParts] = degreeLine.split(",")
    return {
      school,
      degree: degree.trim(),
      field: fieldParts.join(",").trim(),
      start: entry.start,
      end: entry.end,
    }
  })

  const skills = buckets.skills
    .join("\n")
    .split(/[,•|·;\n]/)
    .map((skill) => skill.replace(/^[-*]\s*/, "").trim())
    .filter((skill) => skill.length > 1 && skill.length <= 60 && skill.split(/\s+/).length <= 6)

  return looseResumeData({
    fullName,
    email,
    phone,
    location: locationPart ?? "",
    links,
    experience,
    education,
    skills,
  })
}
