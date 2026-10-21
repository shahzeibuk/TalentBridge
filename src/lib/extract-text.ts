import mammoth from "mammoth"
import { extractText, getDocumentProxy } from "unpdf"

export class ExtractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExtractError"
  }
}

const TOO_SHORT =
  "We couldn't read enough text from this file. Scanned PDFs without a text layer won't work. Export a text-based PDF or a DOCX and try again."

export async function extractPdfText(bytes: Uint8Array) {
  try {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const pdf = await getDocumentProxy(copy)
    const result = await extractText(pdf, { mergePages: true })
    const text = result.text.trim()
    if (text.length < 20) throw new ExtractError(TOO_SHORT)
    return text.slice(0, 500_000)
  } catch (error) {
    if (error instanceof ExtractError) throw error
    throw new ExtractError(
      "We couldn't read this PDF. Export it again as a text-based PDF, or upload a DOCX instead.",
    )
  }
}

export async function extractDocxText(bytes: Uint8Array) {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    const text = result.value.trim()
    if (text.length < 20) throw new ExtractError(TOO_SHORT)
    return text.slice(0, 500_000)
  } catch (error) {
    if (error instanceof ExtractError) throw error
    throw new ExtractError(
      "We couldn't read this DOCX. Save it again from Word or Google Docs, or export a PDF.",
    )
  }
}
