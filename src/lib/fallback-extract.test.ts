import assert from "node:assert/strict"
import { fallbackExtract } from "./fallback-extract"

const sample = `Amina Okonkwo
amina@example.com | +1 (415) 555-0198 | Oakland, CA
https://amina.design
https://www.linkedin.com/in/aminaokonkwo

Experience

Northwind Labs — Senior Product Designer
Mar 2022 – Present
Led the redesign of the hiring workspace and shipped a review flow used by 40 recruiters.

Brightline Studio — Product Designer
Jun 2019 – Feb 2022
Designed onboarding for a marketplace app and maintained the design system.

Education

California College of the Arts
BFA, Interaction Design
2015 – 2019

Skills

Figma, Prototyping, Design systems, User research, Accessibility
`

const parsed = fallbackExtract(sample)

assert.equal(parsed.fullName, "Amina Okonkwo")
assert.equal(parsed.email, "amina@example.com")
assert.equal(parsed.phone, "+1 (415) 555-0198")
assert.equal(parsed.location, "Oakland, CA")
assert.ok(parsed.links.some((link) => link.includes("amina.design")))
assert.equal(parsed.experience.length, 2)
assert.equal(parsed.experience[0]?.company, "Northwind Labs")
assert.equal(parsed.experience[0]?.title, "Senior Product Designer")
assert.equal(parsed.experience[0]?.start, "Mar 2022")
assert.equal(parsed.experience[0]?.end, "Present")
assert.match(parsed.experience[0]?.description ?? "", /hiring workspace/)
assert.equal(parsed.experience[1]?.company, "Brightline Studio")
assert.equal(parsed.education[0]?.school, "California College of the Arts")
assert.equal(parsed.education[0]?.degree, "BFA")
assert.equal(parsed.education[0]?.field, "Interaction Design")
assert.equal(parsed.education[0]?.start, "2015")
assert.equal(parsed.education[0]?.end, "2019")
assert.deepEqual(parsed.skills, ["Figma", "Prototyping", "Design systems", "User research", "Accessibility"])

const collapsed = fallbackExtract(`Jonas Hale
jonas@example.com | +1 (206) 555-0144 | Seattle, WA

Experience
Harbor Analytics - Data Engineer
Jan 2021 Present
Built the warehouse models.

Education
University of Washington
BS, Informatics
2016 2020

Skills
SQL, Python
`)
assert.equal(collapsed.experience[0]?.title, "Data Engineer")
assert.equal(collapsed.experience[0]?.start, "Jan 2021")
assert.equal(collapsed.experience[0]?.end, "Present")
assert.equal(collapsed.education[0]?.end, "2020")

console.log("fallback extractor ok")
