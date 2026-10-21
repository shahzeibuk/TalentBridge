export type WorkspaceSection = "overview" | "profile" | "resumes" | "jobs" | "applications"

export const workspaceNav: { id: WorkspaceSection; label: string; href: string }[] = [
  { id: "overview", label: "Overview", href: "/dashboard?tab=overview" },
  { id: "profile", label: "Profile", href: "/dashboard?tab=profile" },
  { id: "resumes", label: "Resumes", href: "/dashboard?tab=resumes" },
  { id: "jobs", label: "Job postings", href: "/dashboard?tab=jobs" },
  { id: "applications", label: "Applications", href: "/dashboard?tab=applications" },
]

const labels: Record<WorkspaceSection, string> = {
  overview: "Overview",
  profile: "Profile",
  resumes: "Resumes",
  jobs: "Job postings",
  applications: "Applications",
}

export function workspaceSection(
  pathname: string,
  search: { get(name: string): string | null },
): WorkspaceSection {
  if (pathname.startsWith("/resumes")) return "resumes"
  const requested = search.get("tab")
  if (
    requested === "overview" ||
    requested === "profile" ||
    requested === "resumes" ||
    requested === "jobs" ||
    requested === "applications"
  ) {
    return requested
  }
  if (search.get("gmail")) return "applications"
  if (search.get("saved") === "1" || search.get("profile") === "1") return "profile"
  return "overview"
}

export function workspaceTitle(pathname: string, section: WorkspaceSection) {
  if (pathname === "/resumes/new") return "Upload resume"
  if (pathname.endsWith("/review")) return "Review resume"
  if (pathname.endsWith("/edit")) return "Edit resume"
  if (pathname.startsWith("/resumes/")) return "Resume"
  return labels[section]
}
