import type { Metadata } from "next"
import { Figtree, Fraunces } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
})

function metadataBase() {
  try {
    return new URL(process.env.AUTH_URL || "http://127.0.0.1:3847")
  } catch {
    return new URL("http://127.0.0.1:3847")
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: {
    default: "TalentBridge",
    template: "%s · TalentBridge",
  },
  description: "Upload a resume, correct the draft, and keep a profile snapshot you trust.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
