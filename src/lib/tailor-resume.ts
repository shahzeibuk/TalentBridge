import { completeJson } from "@/lib/parse-resume"
import { looseResumeData, type ParseSource, type ResumeData } from "@/lib/resume-data"

const GEMINI_MODEL = "gemini-3.8-flash"
const GROQ_MODEL = "openai/gpt-oss-20b"

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "your", "our", "you", "we",
  "will", "this", "that", "as", "by", "from", "at", "be", "is", "are", "was", "role", "job", "team",
  "work", "working", "experience", "years", "year", "including", "using", "use", "ability", "strong",
  "plus", "required", "requirements", "qualifications", "preferred", "about", "who", "what", "their",
  "them", "into", "across", "other", "such", "able", "have", "has", "must", "should", "can", "may",
])

const TAILOR_SYSTEM = `Tailor a resume for an applicant tracking system. Use only facts from the resume. Reword descriptions so they echo keywords and phrases from the job description when the resume already supports that work. Keep every employer, title, school, degree, and date unchanged. Do not add skills, tools, or metrics that are not already in the resume. Do not invent experience.

Return JSON with fullName, email, phone, location, links, experience (company, title, start, end, description), education (school, degree, field, start, end), and skills.`

export type TailorResult = {
  data: ResumeData
  parseSource: ParseSource
  parseNote: string
  matchedKeywords: string[]
  omittedKeywords: string[]
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+.#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function phraseIn(phrase: string, text: string) {
  const words = normalize(phrase).split(" ").filter(Boolean)
  if (words.length === 0) return false
  const pattern = new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_/]+"), "i")
  return pattern.test(normalize(text))
}

export function jobKeywords(description: string) {
  const chunks = description
    .replace(/\r/g, "")
    .split(/[\n•]|(?<=[.?!])\s+|[,;]|\s+\band\b\s+/i)
    .map((chunk) => chunk.replace(/^[\s\-*–—]+/, "").trim())
    .filter(Boolean)
  const found: string[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    const words = chunk.replace(/[^A-Za-z0-9+.#\s-]/g, " ").split(/\s+/).filter(Boolean)
    while (words.length && STOP.has(words[0].toLowerCase())) words.shift()
    while (words.length && STOP.has(words[words.length - 1].toLowerCase())) words.pop()
    if (words.length === 0 || words.length > 4) continue
    const content = words.filter((word) => !STOP.has(word.toLowerCase()) && (word.length >= 3 || /^[A-Z0-9+.#]{2,}$/.test(word)))
    if (content.length === 0) continue
    const phrase = words.join(" ")
    const key = normalize(phrase)
    if (!key || seen.has(key)) continue
    seen.add(key)
    found.push(phrase)
  }
  return found.slice(0, 40)
}

export function resumePlain(data: ResumeData) {
  return [
    data.fullName,
    data.experience.map((job) => `${job.title} ${job.company} ${job.description}`).join("\n"),
    data.education.map((school) => `${school.degree} ${school.field} ${school.school}`).join("\n"),
    data.skills.join("\n"),
  ].join("\n")
}

function alignPhrasing(description: string, keywords: string[]) {
  let text = description
  for (const keyword of keywords) {
    if (!phraseIn(keyword, text)) continue
    const words = normalize(keyword).split(" ").filter(Boolean)
    const pattern = new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_/]+"), "ig")
    text = text.replace(pattern, keyword)
  }
  return text
}

function numbersOf(value: string) {
  return new Set(value.match(/\d[\d,]*/g) ?? [])
}

export function applyAtsPass(source: ResumeData, description: string): TailorResult {
  const keywords = jobKeywords(description)
  const sourceText = resumePlain(source)
  const matched = keywords.filter((keyword) => phraseIn(keyword, sourceText))
  const omitted = keywords.filter((keyword) => !phraseIn(keyword, sourceText))
  const skills = [...source.skills]
  for (const keyword of matched) {
    if (!skills.some((skill) => normalize(skill) === normalize(keyword))) skills.push(keyword)
  }
  const data = looseResumeData({
    ...source,
    experience: source.experience.map((job) => ({
      ...job,
      description: alignPhrasing(job.description, matched),
    })),
    skills: skills.slice(0, 40),
  })
  return { data, parseSource: "fallback", parseNote: "", matchedKeywords: matched, omittedKeywords: omitted }
}

function honestExperience(source: ResumeData, proposed: ResumeData, keywords: string[]) {
  const sourceText = resumePlain(source)
  return source.experience.map((job, index) => {
    const next = proposed.experience[index]
    if (!next) return job
    if (next.company.trim().toLowerCase() !== job.company.trim().toLowerCase()) return job
    const description = next.description.trim()
    if (!description) return job
    const inventedKeyword = keywords.some((keyword) => phraseIn(keyword, description) && !phraseIn(keyword, sourceText))
    const inventedNumber = [...numbersOf(description)].some((value) => !numbersOf(job.description).has(value))
    if (inventedKeyword || inventedNumber) return job
    return { ...job, description }
  })
}

function noteFor(source: ParseSource, matched: string[], omitted: string[], modelProblem: string) {
  const matchedText = matched.slice(0, 12).join(", ") || "none"
  const omittedText = omitted.slice(0, 12).join(", ") || "none"
  const detail = `Matched keywords already supported by the resume: ${matchedText}. Left out so the draft doesn't claim them: ${omittedText}.`
  if (source === "gemini") {
    return `Tailored for ATS by Gemini (${GEMINI_MODEL}). ${detail} Correct anything that overstates your background before you confirm.`
  }
  if (source === "groq") {
    return `Tailored for ATS by Groq (${GROQ_MODEL}). ${detail} Correct anything that overstates your background before you confirm.`
  }
  const why = modelProblem
    ? `${modelProblem} `
    : "No model key is set, so this draft used the local ATS pass. "
  return `${why}${detail} An AI model did not produce this draft.`
}

export async function tailorResume(
  source: ResumeData,
  job: { title: string; company: string; description: string },
  deps: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<TailorResult> {
  const local = applyAtsPass(source, job.description)
  const env = deps.env ?? process.env
  const provider = (env.AI_PROVIDER ?? "gemini").trim().toLowerCase()
  const localNote = (reason: string) => ({
    ...local,
    parseNote: noteFor("fallback", local.matchedKeywords, local.omittedKeywords, reason),
  })
  if (provider === "fallback") return localNote("AI_PROVIDER is fallback, so this draft used the local ATS pass.")
  if (provider !== "gemini" && provider !== "groq") {
    return localNote(`AI_PROVIDER "${provider}" isn't gemini, groq, or fallback.`)
  }
  if (provider === "groq" && !env.GROQ_API_KEY?.trim()) {
    return localNote("AI_PROVIDER is groq, but GROQ_API_KEY is not set.")
  }
  if (provider === "gemini" && !env.GEMINI_API_KEY?.trim()) {
    return localNote("No GEMINI_API_KEY is set, so this draft used the local ATS pass.")
  }

  try {
    const result = await completeJson(
      TAILOR_SYSTEM,
      `Job title: ${job.title}\nCompany: ${job.company}\nJob description:\n${job.description.slice(0, 12_000)}\n\nResume JSON:\n${JSON.stringify(source).slice(0, 12_000)}`,
      deps,
    )
    if (result.provider === "fallback") {
      return { ...local, parseNote: noteFor("fallback", local.matchedKeywords, local.omittedKeywords, result.note) }
    }
    const proposed = looseResumeData(result.json)
    const data = looseResumeData({
      ...source,
      experience: honestExperience(source, proposed, jobKeywords(job.description)),
      skills: local.data.skills,
    })
    return {
      data,
      parseSource: result.provider,
      parseNote: noteFor(result.provider, local.matchedKeywords, local.omittedKeywords, ""),
      matchedKeywords: local.matchedKeywords,
      omittedKeywords: local.omittedKeywords,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The AI request failed."
    const who = provider === "groq" ? "Groq" : "Gemini"
    return {
      ...local,
      parseNote: noteFor("fallback", local.matchedKeywords, local.omittedKeywords, `${who} didn't return a usable draft (${reason}).`),
    }
  }
}

export function renderTailoredText(data: ResumeData) {
  const lines = [
    data.fullName,
    [data.email, data.phone, data.location].filter(Boolean).join(" · "),
    data.links.join("\n"),
    "",
    "Experience",
    ...data.experience.flatMap((job) => [
      [job.title, job.company].filter(Boolean).join(" — "),
      [job.start, job.end].filter(Boolean).join(" – "),
      job.description,
      "",
    ]),
    "Education",
    ...data.education.flatMap((school) => [
      [school.degree, school.field, school.school].filter(Boolean).join(", "),
      [school.start, school.end].filter(Boolean).join(" – "),
      "",
    ]),
    "Skills",
    data.skills.join(", "),
    "",
  ]
  return lines.join("\n").trim()
}
