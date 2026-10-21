export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const HOST_BODY_LIMIT_BYTES = Math.floor(4.5 * 1024 * 1024)

const PDF_MIME = "application/pdf"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type UploadKind = "pdf" | "docx"

export function formatMegabytes(size: number) {
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function extensionOf(fileName: string) {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith(".docx")) return "docx"
  if (lower.endsWith(".doc")) return "doc"
  if (lower.endsWith(".pdf")) return "pdf"
  return ""
}

function isPdf(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
}

function isZip(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  )
}

function isOleCompound(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
}

export function clientUploadError(file: { name: string; size: number }) {
  if (file.size <= 0) return "That file is empty. Choose the resume PDF or DOCX."
  if (file.size > MAX_UPLOAD_BYTES) {
    return `This file is ${formatMegabytes(file.size)}. TalentBridge accepts PDF and DOCX resumes up to 4 MB so the upload stays under Vercel's roughly 4.5 MB request limit.`
  }
  const extension = extensionOf(file.name)
  if (extension === "doc") {
    return "Word .doc files aren't supported. Save the resume as .docx or export a PDF."
  }
  if (extension !== "pdf" && extension !== "docx") {
    return "Upload a PDF or DOCX resume. Other file types aren't accepted."
  }
  return null
}

export function inspectUpload(
  fileName: string,
  bytes: Uint8Array,
): { ok: true; kind: UploadKind; mimeType: string; fileName: string } | { ok: false; error: string } {
  const preliminary = clientUploadError({ name: fileName, size: bytes.byteLength })
  if (preliminary) return { ok: false, error: preliminary }

  const extension = extensionOf(fileName)
  if (extension === "pdf") {
    if (!isPdf(bytes)) {
      return {
        ok: false,
        error: "This file uses a .pdf name, but it isn't a PDF. Export the resume again and retry.",
      }
    }
    return {
      ok: true,
      kind: "pdf",
      mimeType: PDF_MIME,
      fileName: fileName.trim().slice(0, 180),
    }
  }

  if (isOleCompound(bytes)) {
    return {
      ok: false,
      error: "Word .doc files aren't supported. Save the resume as .docx or export a PDF.",
    }
  }

  if (!isZip(bytes)) {
    return {
      ok: false,
      error: "This file uses a .docx name, but it isn't a Word document. Save it again as .docx or export a PDF.",
    }
  }

  return {
    ok: true,
    kind: "docx",
    mimeType: DOCX_MIME,
    fileName: fileName.trim().slice(0, 180) || "resume.docx",
  }
}
