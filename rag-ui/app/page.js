"use client"

import { useEffect, useState } from "react"
import axios from "axios"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
const BACKEND_API_KEY = process.env.NEXT_PUBLIC_BACKEND_API_KEY || ""

function getAuthHeaders() {
  return BACKEND_API_KEY ? { "x-api-key": BACKEND_API_KEY } : {}
}

function formatError(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.detail || error.message || fallback
  }
  return fallback
}

function AssistantMessage({ content }) {
  const lines = String(content || "").split("\n")
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    if (line.trim().startsWith("```")) {
      const code = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i])
        i += 1
      }
      blocks.push({ type: "code", content: code.join("\n") })
      if (i < lines.length) i += 1
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""))
        i += 1
      }
      blocks.push({ type: "ul", items })
      continue
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""))
        i += 1
      }
      blocks.push({ type: "ol", items })
      continue
    }

    const paragraph = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith("```")) {
      paragraph.push(lines[i])
      i += 1
    }
    blocks.push({ type: "p", content: paragraph.join(" ") })
  }

  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return (
            <pre key={idx} className="bg-gray-900 text-gray-100 text-xs rounded-xl p-3 overflow-x-auto">
              <code>{block.content}</code>
            </pre>
          )
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{item}</li>
              ))}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{item}</li>
              ))}
            </ol>
          )
        }
        return (
          <p key={idx} className="text-[0.95rem]">
            {block.content}
          </p>
        )
      })}
    </div>
  )
}

function UserMessage({ content }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-emerald-100/90">You</div>
      <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  )
}

export default function Home() {
  const [file, setFile] = useState(null)
  const [uuid, setUuid] = useState(null)
  const [documentReady, setDocumentReady] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!uuid) return

    let cancelled = false
    let timerId = null

    const pollStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/document-status/${uuid}`, {
          headers: {
            ...getAuthHeaders(),
          },
        })
        if (cancelled) return

        const nextStatus = res.data.index_status
        if (nextStatus === "completed") {
          setDocumentReady(true)
          setStatus("Document uploaded successfully.")
          return
        }
        if (nextStatus === "failed") {
          setDocumentReady(false)
          setStatus(`Indexing failed: ${res.data.error_message || "Unknown error"}`)
          return
        }

        setDocumentReady(false)
        setStatus("Document uploaded. Indexing in progress...")
        timerId = setTimeout(pollStatus, 2000)
      } catch (error) {
        if (cancelled) return
        setDocumentReady(false)
        setStatus(`Status check failed: ${formatError(error, "Unknown status error")}`)
        timerId = setTimeout(pollStatus, 3000)
      }
    }

    pollStatus()
    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
    }
  }, [uuid])

  const uploadFile = async () => {
    if (!file) {
      setStatus("Select a PDF before uploading.")
      return
    }

    setStatus("Uploading...")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          ...getAuthHeaders(),
        },
      })
      setDocumentReady(false)
      setUuid(res.data.document_id)
      setStatus("Document uploaded. Indexing in progress...")
    } catch (error) {
      setStatus(`Upload failed: ${formatError(error, "Unknown upload error")}`)
    }
  }

  const askQuestion = async () => {
    if (!question || !uuid) return
    if (!documentReady) {
      setStatus("Please wait. Document indexing is still in progress.")
      return
    }

    setLoading(true)
    setStatus("Asking...")
    setMessages((prev) => [...prev, { role: "user", content: question }])

    try {
      const res = await axios.post(
        `${API_BASE_URL}/ask`,
        {
          question,
          document_id: uuid,
        },
        {
          headers: {
            ...getAuthHeaders(),
          },
        }
      )

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.answer },
      ])
      setQuestion("")
      setStatus("Answer received.")
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Request failed: ${formatError(error, "Unknown ask error")}` },
      ])
      setStatus("Ask failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-4xl bg-white/60 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/40">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">RAG Document Chat</h1>
          <p className="text-gray-600 mt-2">Ask grounded questions from your uploaded PDF</p>
        </div>

        <div className="text-xs text-gray-500 mb-3 text-center">
          API: {API_BASE_URL}
        </div>

        <div className="flex items-center justify-between mb-6 bg-white/70 rounded-xl p-4 shadow-sm">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-sm text-gray-600"
          />

          <button
            onClick={uploadFile}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl transition"
          >
            Upload
          </button>
        </div>

        {status && (
          <div className="text-sm text-gray-600 mb-3 text-center">{status}</div>
        )}

        <div className="h-80 overflow-y-auto space-y-4 mb-6 px-2">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-4 py-3 rounded-2xl text-sm shadow ${
                  msg.role === "user"
                    ? "max-w-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border border-emerald-400/40"
                    : "max-w-2xl bg-gradient-to-br from-white to-emerald-50 text-gray-800 border border-emerald-100"
                }`}
              >
                {msg.role === "assistant" ? <AssistantMessage content={msg.content} /> : <UserMessage content={msg.content} />}
              </div>
            </div>
          ))}

          {loading && <div className="text-gray-500 text-sm animate-pulse">AI is thinking...</div>}
        </div>

        <div className="flex items-center bg-white/80 rounded-2xl shadow-inner px-4 py-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your document..."
            className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400"
          />

          <button
            onClick={askQuestion}
            disabled={!uuid || !documentReady || loading}
            className="ml-4 bg-gray-800 text-white px-5 py-2 rounded-xl disabled:opacity-40 transition"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
