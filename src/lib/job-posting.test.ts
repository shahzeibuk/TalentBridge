import { extractJobPosting, extractListedJobs, importJobsFromUrl, isPrivateAddress, scrapeJobUrl, ScrapeError } from "./job-scrape"
import { applyAtsPass, jobKeywords } from "./tailor-resume"
import type { ResumeData } from "./resume-data"

if (!isPrivateAddress("127.0.0.1") || !isPrivateAddress("10.1.2.3") || !isPrivateAddress("192.168.0.8")) {
  throw new Error("private ipv4 was allowed")
}
if (!isPrivateAddress("169.254.169.254") || !isPrivateAddress("::1")) throw new Error("metadata or loopback allowed")
if (isPrivateAddress("8.8.8.8") || isPrivateAddress("example.com")) throw new Error("public host treated as private")

const html = `<!doctype html><html><head>
<script type="application/ld+json">
{"@type":"JobPosting","title":"Senior Product Designer","hiringOrganization":{"name":"Northwind Labs"},"description":"<p>Own the hiring workspace used by recruiters.</p><ul><li>Figma</li><li>design systems</li><li>Kubernetes</li></ul><p>You will partner with research and engineering on the review flow.</p>"}
</script>
</head><body><h1>Board listing</h1></body></html>`

const extracted = extractJobPosting(html)
if (extracted.title !== "Senior Product Designer" || extracted.company !== "Northwind Labs") {
  throw new Error(`extract failed ${JSON.stringify(extracted)}`)
}
if (!extracted.description.includes("Figma") || !extracted.description.includes("hiring workspace")) {
  throw new Error(`description missing ${extracted.description}`)
}

async function main() {
let fetched = false
try {
  await scrapeJobUrl("http://127.0.0.1/jobs/1", {
    lookupImpl: async () => [{ address: "127.0.0.1", family: 4 }],
    fetchPage: async () => {
      fetched = true
      return { status: 200, headers: { "content-type": "text/html" }, body: html }
    },
  })
  throw new Error("private url was scraped")
} catch (error) {
  if (!(error instanceof ScrapeError) || fetched) throw error
}

const blocked = await scrapeJobUrl("https://jobs.example/1", {
  lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
  fetchPage: async () => ({ status: 403, headers: {}, body: "no" }),
}).catch((error: unknown) => error)
if (!(blocked instanceof ScrapeError) || !blocked.message.includes("blocked")) {
  throw new Error(`blocked message missing ${blocked}`)
}

const saved = await scrapeJobUrl("https://jobs.example/1", {
  lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
  fetchPage: async () => ({ status: 200, headers: { "content-type": "text/html" }, body: html }),
})
if (saved.company !== "Northwind Labs") throw new Error("scrape did not keep the company")

const resume: ResumeData = {
  fullName: "Amina Okonkwo",
  email: "amina@example.com",
  phone: "",
  location: "Oakland, CA",
  links: [],
  experience: [
    {
      company: "Northwind Labs",
      title: "Senior Product Designer",
      start: "Mar 2022",
      end: "Present",
      description: "Led the redesign of the hiring workspace and maintained the design systems.",
    },
  ],
  education: [],
  skills: ["Figma", "Prototyping"],
}

const keywords = jobKeywords("Requirements: Figma, design systems, and Kubernetes.")
if (!keywords.some((item) => /figma/i.test(item)) || !keywords.some((item) => /kubernetes/i.test(item))) {
  throw new Error(`keywords ${keywords.join(" | ")}`)
}

const tailored = applyAtsPass(resume, "Requirements: Figma, design systems, and Kubernetes. Partner with recruiting.")
if (!tailored.matchedKeywords.some((item) => /figma/i.test(item))) throw new Error("figma was not matched")
if (!tailored.matchedKeywords.some((item) => /design systems/i.test(item))) throw new Error("design systems was not matched")
if (tailored.omittedKeywords.some((item) => /figma/i.test(item))) throw new Error("figma was omitted")
if (!tailored.omittedKeywords.some((item) => /kubernetes/i.test(item))) throw new Error("kubernetes was not omitted")
if (tailored.data.skills.some((item) => /kubernetes/i.test(item))) throw new Error("kubernetes was added")
if (!tailored.data.skills.some((item) => /design systems/i.test(item))) throw new Error("design systems was not added")
if (!tailored.data.experience[0].description.includes("design systems")) throw new Error("phrasing was not kept")
if (tailored.data.experience[0].company !== "Northwind Labs") throw new Error("employer changed")

const listing = `<!doctype html><html><body><main></main><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialJobOpenings":[
{"roleTitle":"Product Designer","company":{"name":"Minerva Project"},"url":"https://jobs.example/minerva","twoLineJobDescriptionSummary":"Product Designer creating accessible software for a global higher-education platform and the workflows students use.","location":"Worldwide"},
{"roleTitle":"UI/UX Designer","company":{"name":"Huzzle"},"url":"https://jobs.example/huzzle","twoLineJobDescriptionSummary":"UI/UX Designer owning end-to-end design for an international company and its digital products across web and mobile.","location":"Remote"}
]}}}</script></body></html>`
const listed = extractListedJobs(listing)
if (listed.length !== 2 || listed[0].company !== "Minerva Project") throw new Error(`list extract ${JSON.stringify(listed)}`)

const imported = await importJobsFromUrl("https://board.example/ux", {
  lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
  fetchPage: async (url) => {
    if (url.hostname === "board.example") return { status: 200, headers: { "content-type": "text/html" }, body: listing }
    if (url.pathname === "/minerva") return { status: 200, headers: { "content-type": "text/html" }, body: html }
    return { status: 403, headers: { "content-type": "text/html" }, body: "blocked" }
  },
})
if (imported.length !== 2) throw new Error(`import count ${imported.length}`)
if (imported[0].company !== "Minerva Project" || imported[0].sourceUrl !== "https://jobs.example/minerva") {
  throw new Error(`child scrape ${JSON.stringify(imported[0])}`)
}
if (!imported[0].description.includes("hiring workspace")) throw new Error("full description was dropped")
if (imported[1].company !== "Huzzle" || !imported[1].description.includes("Location: Remote")) {
  throw new Error(`summary fallback ${JSON.stringify(imported[1])}`)
}

console.log("job posting helpers ok")
}

void main()
