"use client"

import { useEffect, useRef, useState } from "react"
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

function cleanAssistantContent(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/LLM request failed:[\s\S]*$/i, "")
    .trim()
}

function cleanInline(value) {
  return String(value || "").replace(/\*\*/g, "").trim()
}

function AssistantMessage({ content }) {
  const lines = cleanAssistantContent(content).split("\n")
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
        items.push(cleanInline(lines[i].trim().replace(/^\d+\.\s+/, "")))
        i += 1
      }
      blocks.push({ type: "ol", items })
      continue
    }

    if (/^[A-Za-z][A-Za-z0-9\s()\/-]{1,40}:\s+.+$/.test(line.trim())) {
      const rows = []
      while (i < lines.length && /^[A-Za-z][A-Za-z0-9\s()\/-]{1,40}:\s+.+$/.test(lines[i].trim())) {
        const current = cleanInline(lines[i].trim())
        const sepIdx = current.indexOf(":")
        rows.push({
          key: current.slice(0, sepIdx).trim(),
          value: current.slice(sepIdx + 1).trim(),
        })
        i += 1
      }
      blocks.push({ type: "kv", rows })
      continue
    }

    const paragraph = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith("```")) {
      paragraph.push(lines[i])
      i += 1
    }
    blocks.push({ type: "p", content: cleanInline(paragraph.join(" ")) })
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
                <li key={itemIdx}>{cleanInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{cleanInline(item)}</li>
              ))}
            </ol>
          )
        }
        if (block.type === "kv") {
          return (
            <div key={idx} className="rounded-xl border border-emerald-100 bg-white/70 p-3 space-y-1.5">
              {block.rows.map((row, rowIdx) => (
                <div key={rowIdx} className="grid grid-cols-[120px_1fr] gap-2 text-[0.92rem]">
                  <span className="text-gray-500 font-medium">{row.key}</span>
                  <span className="text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
          )
        }
        return (
          <p key={idx} className="text-[0.95rem]">
            {cleanInline(block.content)}
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
  const [isListening, setIsListening] = useState(false)

  const recognitionRef = useRef(null)
  const transcriptRef = useRef("")

  useEffect(() => {
    if (typeof window === "undefined") return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      let interim = ""
      let finalTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const value = event.results[i][0]?.transcript || ""
        if (event.results[i].isFinal) {
          finalTranscript += value
        } else {
          interim += value
        }
      }

      transcriptRef.current = `${transcriptRef.current} ${finalTranscript}`.trim()
      const liveText = `${transcriptRef.current} ${interim}`.trim()
      setQuestion(liveText)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
      transcriptRef.current = ""
      setStatus("Voice input failed. Please try again or type your question.")
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

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

  const startVoiceInput = () => {
    if (!recognitionRef.current) {
      setStatus("Voice input is not available in this browser.")
      return
    }

    transcriptRef.current = ""
    setIsListening(true)
    recognitionRef.current.start()
  }

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  const askQuestion = async () => {
    if (!question || !uuid) return
    if (!documentReady) {
      setStatus("Please wait. Document indexing is still in progress.")
      return
    }

    setLoading(true)
    setStatus("Asking...")
    const userText = question
    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: userText },
      { id: assistantId, role: "assistant", content: "" },
    ])
    setQuestion("")

    try {
      const res = await fetch(`${API_BASE_URL}/ask/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          question: userText,
          document_id: uuid,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
      }

      if (!res.body) {
        throw new Error("No response stream received")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: `${msg.content}${chunk}` }
              : msg
          )
        )
      }

      setStatus("Answer received.")
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Request failed: ${formatError(error, "Unknown ask error")}` }
            : msg
        )
      )
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
              key={msg.id || idx}
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
            onClick={isListening ? stopVoiceInput : startVoiceInput}
            disabled={loading}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
            title={isListening ? "Stop voice input" : "Start voice input"}
            className="ml-3 h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`h-5 w-5 ${isListening ? "animate-pulse" : ""}`}
              aria-hidden="true"
            >
              <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
              <path d="M17 11a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.1A5 5 0 0 0 17 11Z" />
            </svg>
          </button>

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
