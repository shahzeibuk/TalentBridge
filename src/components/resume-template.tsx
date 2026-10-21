import { whenRange } from "@/lib/format"
import type { ResumeData } from "@/lib/resume-data"

function hrefFor(link: string) {
  if (/^https?:\/\//i.test(link)) return link
  return `https://${link}`
}

function parts(text: string) {
  return text
    .split(/\n+|•|·(?=\s)/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function ResumeTemplate({ data }: { data: ResumeData }) {
  const headline = data.experience.find((job) => job.title.trim())?.title.trim() || ""
  const contact = [data.email, data.phone, data.location].filter((item) => item.trim())
  const empty = !data.fullName.trim() && data.experience.length === 0 && data.education.length === 0 && data.skills.length === 0

  return (
    <article className="resume-sheet mx-auto w-full max-w-[820px] bg-white px-6 py-8 text-neutral-900 shadow-2xl sm:px-12 sm:py-12 print:max-w-none print:shadow-none">
      <header className="border-b-2 border-neutral-900 pb-4">
        <h2 className="font-[family-name:var(--font-fraunces)] text-4xl tracking-tight text-neutral-950">
          {data.fullName.trim() || "Name not set"}
        </h2>
        {headline ? <p className="mt-1 text-base text-neutral-700">{headline}</p> : null}
        {contact.length > 0 ? (
          <p className="mt-3 text-sm leading-6 text-neutral-600">{contact.join("  ·  ")}</p>
        ) : null}
        {data.links.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
            {data.links.map((link) => (
              <li key={link}>
                <a href={hrefFor(link)} className="underline decoration-neutral-300 underline-offset-4" target="_blank" rel="noreferrer">
                  {link.replace(/^https?:\/\//i, "")}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {empty ? (
        <p className="mt-8 text-sm leading-6 text-neutral-600">
          This template fills in when the resume has a name, roles, education, or skills.
        </p>
      ) : null}

      {data.experience.length > 0 ? (
        <section className="mt-7">
          <h3 className="border-b border-neutral-300 pb-1 text-xs font-semibold tracking-[0.18em] text-neutral-500 uppercase">
            Experience
          </h3>
          <ul className="mt-4 space-y-5">
            {data.experience.map((job, index) => {
              const detail = parts(job.description)
              return (
                <li key={`${job.company}-${job.title}-${index}`}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <p className="font-semibold text-neutral-950">{job.title.trim() || "Title not set"}</p>
                    <p className="shrink-0 text-sm text-neutral-600">{whenRange(job.start, job.end)}</p>
                  </div>
                  <p className="text-sm text-neutral-700">{job.company.trim() || "Company not set"}</p>
                  {detail.length > 1 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-800">
                      {detail.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : detail.length === 1 ? (
                    <p className="mt-2 text-sm leading-6 text-neutral-800">{detail[0]}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {data.education.length > 0 ? (
        <section className="mt-7">
          <h3 className="border-b border-neutral-300 pb-1 text-xs font-semibold tracking-[0.18em] text-neutral-500 uppercase">
            Education
          </h3>
          <ul className="mt-4 space-y-4">
            {data.education.map((school, index) => (
              <li key={`${school.school}-${index}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <p className="font-semibold text-neutral-950">{school.school.trim() || "School not set"}</p>
                  <p className="shrink-0 text-sm text-neutral-600">{whenRange(school.start, school.end)}</p>
                </div>
                <p className="text-sm text-neutral-700">{[school.degree, school.field].filter((item) => item.trim()).join(", ")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.skills.length > 0 ? (
        <section className="mt-7">
          <h3 className="border-b border-neutral-300 pb-1 text-xs font-semibold tracking-[0.18em] text-neutral-500 uppercase">
            Skills
          </h3>
          <p className="mt-3 text-sm leading-6 text-neutral-800">{data.skills.filter((skill) => skill.trim()).join("  ·  ")}</p>
        </section>
      ) : null}
    </article>
  )
}
