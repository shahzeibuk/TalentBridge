import { Badge } from "@/components/ui/badge"
import { whenRange } from "@/lib/format"
import type { ResumeData } from "@/lib/resume-data"

function hrefFor(link: string) {
  if (/^https?:\/\//i.test(link)) return link
  return `https://${link}`
}

export function ResumeDetails({ data }: { data: ResumeData }) {
  const contact = [data.email, data.phone, data.location].filter(Boolean)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl tracking-tight">{data.fullName || "Name not set"}</h2>
        {contact.length > 0 ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{contact.join(" · ")}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No contact details yet.</p>
        )}
        {data.links.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.links.map((link) => (
              <li key={link}>
                <a
                  href={hrefFor(link)}
                  className="break-all text-sm text-primary underline underline-offset-4"
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.replace(/^https?:\/\//i, "")}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <section>
        <h3 className="font-heading text-xl">Experience</h3>
        {data.experience.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No jobs saved.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {data.experience.map((job, index) => (
              <li key={`${job.company}-${job.title}-${index}`} className="border-l-2 border-primary/30 pl-4">
                <p className="font-medium">{job.title || "Title not set"}</p>
                <p className="text-sm text-muted-foreground">
                  {[job.company || "Company not set", whenRange(job.start, job.end)].filter(Boolean).join(" · ")}
                </p>
                {job.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{job.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-heading text-xl">Education</h3>
        {data.education.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No schools saved.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.education.map((school, index) => (
              <li key={`${school.school}-${index}`}>
                <p className="font-medium">{school.school || "School not set"}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    [school.degree, school.field].filter(Boolean).join(", "),
                    whenRange(school.start, school.end),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-heading text-xl">Skills</h3>
        {data.skills.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No skills saved.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.skills.map((skill) => (
              <li key={skill}>
                <Badge variant="secondary">{skill}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
