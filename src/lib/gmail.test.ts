import { encryptSecret, decryptSecret } from "./secret-box"
import { addressFromHeader, buildRawMessage, classifyThread, safeAttachmentName } from "./gmail"

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-at-least-16"

const roundTrip = decryptSecret(encryptSecret("refresh-token-value"))
if (roundTrip !== "refresh-token-value") throw new Error("secret box round trip failed")

const attachmentName = safeAttachmentName('amina\r\n"x".docx')
if (attachmentName !== "amina _x_.docx") throw new Error(`attachment name ${attachmentName}`)

const raw = buildRawMessage({
  from: "amina@example.com",
  to: "hiring@example.com",
  subject: "Hello\r\nBcc: evil@example.com",
  text: "Cover letter for the role.",
  fileName: "amina.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  bytes: new Uint8Array([1, 2, 3, 4]),
})
const mime = Buffer.from(raw, "base64url").toString("utf8")
if (mime.includes("Bcc:")) throw new Error("subject injection survived")
if (!mime.includes("To: hiring@example.com")) throw new Error("missing recipient")
if (!mime.includes('filename="amina.docx"')) throw new Error("missing attachment name")
const letter = Buffer.from("Cover letter for the role.", "utf8").toString("base64")
if (!mime.includes(letter)) throw new Error("missing cover letter")

if (addressFromHeader("Alex Chen <alex@example.com>") !== "alex@example.com") {
  throw new Error("address parse failed")
}

const waiting = classifyThread(
  [{ from: "Amina <amina@example.com>", snippet: "Cover letter" }],
  "amina@example.com",
)
if (waiting.replyStatus !== "waiting") throw new Error("own message counted as a reply")

const replied = classifyThread(
  [
    { from: "Amina <amina@example.com>", snippet: "Cover letter" },
    { from: "Alex Chen <alex@example.com>", snippet: "Thanks, let's talk next week." },
  ],
  "amina@example.com",
)
if (replied.replyStatus !== "replied" || replied.replyFrom !== "Alex Chen <alex@example.com>") {
  throw new Error(`reply classification failed ${JSON.stringify(replied)}`)
}

console.log("gmail helpers ok")
