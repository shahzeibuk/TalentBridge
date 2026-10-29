import { completeJson } from "@/lib/parse-resume"

export const DASHBOARD_ACTIONS = [
  { id: "open_profile", label: "Open profile", tab: "profile" as const },
  { id: "open_resumes", label: "Open resumes", tab: "resumes" as const },
  { id: "open_jobs", label: "Open job postings", tab: "jobs" as const },
  { id: "open_applications", label: "Open applications", tab: "applications" as const },
  { id: "open_ai", label: "Open AI keys", tab: "ai" as const },
  { id: "upload_resume", label: "Upload a resume", href: "/resumes/new" },
  { id: "connect_gmail", label: "Connect Gmail", href: "/api/gmail/connect" },
] as const

export type DashboardActionId = (typeof DASHBOARD_ACTIONS)[number]["id"]

export type DashboardAgentContext = {
  name: string
  gmail: string
  resumes: number
  confirmed: number
  drafts: number
  jobs: number
  sent: number
  waiting: number
  replied: number
  profileScore: number
  profileTotal: number
  missingProfile: string[]
  recent: string[]
  readout: string
}

export type DashboardAgentAction = {
  id: DashboardActionId
  label: string
}

export type DashboardAgentResult = {
  reply: string
  actions: DashboardAgentAction[]
  source: "gemini" | "groq" | "fallback"
}

const ACTION_IDS = new Set(DASHBOARD_ACTIONS.map((action) => action.id))

const SYSTEM_PROMPT = `You are TalentBridge's dashboard agent. Help the signed-in user get the next useful thing done in this app.

You can only recommend these action ids:
${DASHBOARD_ACTIONS.map((action) => `- ${action.id}: ${action.label}`).join("\n")}

Return JSON only:
{
  "reply": "short helpful answer in plain language",
  "actions": [{ "id": "upload_resume", "label": "optional short button label" }]
}

Rules:
- Keep reply under 80 words.
- Suggest 1 to 3 actions max.
- Only use action ids from the list.
- If they need an API key for AI parsing, include open_ai.
- If they have no resume, prioritize upload_resume.
- If they have resumes but no jobs, prioritize open_jobs.
- If they have jobs and resumes but Gmail is not connected, include connect_gmail when sending matters.
- Do not invent features outside TalentBridge.`

function actionLabel(id: DashboardActionId, override?: string) {
  const found = DASHBOARD_ACTIONS.find((action) => action.id === id)
  const label = override?.trim()
  return label || found?.label || id
}

function sanitizeActions(raw: unknown): DashboardAgentAction[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const actions: DashboardAgentAction[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const id = "id" in item ? String((item as { id: unknown }).id) : ""
    if (!ACTION_IDS.has(id as DashboardActionId) || seen.has(id)) continue
    seen.add(id)
    const label =
      "label" in item && typeof (item as { label: unknown }).label === "string"
        ? String((item as { label: string }).label)
        : undefined
    actions.push({ id: id as DashboardActionId, label: actionLabel(id as DashboardActionId, label) })
    if (actions.length >= 3) break
  }
  return actions
}

function localPlan(message: string, context: DashboardAgentContext): DashboardAgentResult {
  const text = message.toLowerCase()
  const actions: DashboardAgentAction[] = []
  let reply = ""

  if (context.resumes === 0 || /upload|resume/.test(text)) {
    reply =
      context.resumes === 0
        ? "You don't have a resume on this account yet. Upload a PDF or DOCX first, then confirm the fields as your profile."
        : "Open Resumes to review what you already saved, or upload another file."
    actions.push({ id: "upload_resume", label: actionLabel("upload_resume") })
    if (context.resumes > 0) actions.push({ id: "open_resumes", label: actionLabel("open_resumes") })
  } else if (context.jobs === 0 || /job|posting/.test(text)) {
    reply = "Add a job posting next. Paste a job URL or the description on Job postings, then you can tailor a resume for it."
    actions.push({ id: "open_jobs", label: actionLabel("open_jobs") })
  } else if (/gmail|send|application|apply/.test(text)) {
    reply =
      context.gmail.toLowerCase().includes("not connected") || context.gmail.toLowerCase().includes("isn't configured")
        ? "To send applications, connect Gmail first. Then open Applications to compose a cover letter with a saved resume."
        : "Open Applications to compose and send a cover letter with a saved resume from your connected Gmail."
    if (context.gmail.toLowerCase().includes("not connected") || context.gmail.toLowerCase().includes("isn't configured")) {
      actions.push({ id: "connect_gmail", label: actionLabel("connect_gmail") })
    }
    actions.push({ id: "open_applications", label: actionLabel("open_applications") })
  } else if (/ai|gemini|groq|key|timeout|model/.test(text)) {
    reply = "AI parsing uses the key on your account. Open AI keys to add Gemini or Groq and test the connection."
    actions.push({ id: "open_ai", label: actionLabel("open_ai") })
  } else if (context.missingProfile.length > 0 || /profile/.test(text)) {
    reply = `Your profile snapshot still needs: ${context.missingProfile.slice(0, 4).join(", ") || "a few fields"}. Confirm a resume or open Profile to review it.`
    actions.push({ id: "open_profile", label: actionLabel("open_profile") })
    if (context.drafts > 0) actions.push({ id: "open_resumes", label: "Review resume drafts" })
  } else {
    reply = `Here's your account: ${context.readout}. I can help you upload a resume, add a posting, connect Gmail, or set an AI key.`
    if (context.drafts > 0) actions.push({ id: "open_resumes", label: "Review drafts" })
    else if (context.jobs === 0) actions.push({ id: "open_jobs", label: actionLabel("open_jobs") })
    else actions.push({ id: "open_applications", label: actionLabel("open_applications") })
    actions.push({ id: "open_ai", label: actionLabel("open_ai") })
  }

  return { reply, actions: actions.slice(0, 3), source: "fallback" }
}

export async function runDashboardAgent(
  message: string,
  context: DashboardAgentContext,
  env: NodeJS.ProcessEnv,
): Promise<DashboardAgentResult> {
  const trimmed = message.trim()
  if (!trimmed) {
    return {
      reply: "Ask what to do next, or tell me whether you want to upload a resume, add a job, send an application, or set an AI key.",
      actions: [
        { id: "upload_resume", label: actionLabel("upload_resume") },
        { id: "open_jobs", label: actionLabel("open_jobs") },
        { id: "open_ai", label: actionLabel("open_ai") },
      ],
      source: "fallback",
    }
  }

  const local = localPlan(trimmed, context)
  try {
    const result = await completeJson(
      SYSTEM_PROMPT,
      `User name: ${context.name}
Gmail: ${context.gmail}
Resumes: ${context.resumes} (confirmed ${context.confirmed}, drafts ${context.drafts})
Job postings: ${context.jobs}
Applications sent: ${context.sent}; waiting ${context.waiting}; replies ${context.replied}
Profile fields filled: ${context.profileScore}/${context.profileTotal}
Missing profile fields: ${context.missingProfile.join(", ") || "none"}
Recent activity: ${context.recent.join(" | ") || "none"}
Summary: ${context.readout}

User message: ${trimmed}`,
      { env },
    )
    if (result.provider === "fallback") {
      return { ...local, reply: `${local.reply} (Using local guidance because no AI key answered.)` }
    }
    const data = result.json as { reply?: unknown; actions?: unknown }
    const reply = typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : local.reply
    const actions = sanitizeActions(data.actions)
    return {
      reply,
      actions: actions.length > 0 ? actions : local.actions,
      source: result.provider,
    }
  } catch {
    return local
  }
}

export function resolveDashboardAction(id: DashboardActionId) {
  return DASHBOARD_ACTIONS.find((action) => action.id === id) ?? null
}
