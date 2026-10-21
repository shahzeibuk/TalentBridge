import { z } from "zod"

export type JobPostingItem = {
  id: string
  sourceUrl: string
  title: string
  company: string
  description: string
  source: "scraped" | "manual"
  createdAt: string
  updatedAt: string
}

export const manualJobSchema = z.object({
  title: z.string().trim().min(1, "Enter the job title.").max(160),
  company: z.string().trim().min(1, "Enter the company name.").max(160),
  description: z.string().trim().min(40, "Paste the job description.").max(40000),
  sourceUrl: z.string().trim().max(2000).optional(),
})

export const importJobSchema = z.object({
  url: z.string().trim().min(1, "Paste a job posting URL.").max(2000),
})

export function asJobSource(value: string): JobPostingItem["source"] {
  return value === "scraped" ? "scraped" : "manual"
}
