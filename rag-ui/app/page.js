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
    if (!line.trim()) { i += 1; continue }

    if (line.trim().startsWith("```")) {
      const code = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i += 1 }
      blocks.push({ type: "code", content: code.join("\n") })
      if (i < lines.length) i += 1
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i += 1 }
      blocks.push({ type: "ul", items })
      continue
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(cleanInline(lines[i].trim().replace(/^\d+\.\s+/, ""))); i += 1 }
      blocks.push({ type: "ol", items })
      continue
    }

    if (/^[A-Za-z][A-Za-z0-9\s()\/-]{1,40}:\s+.+$/.test(line.trim())) {
      const rows = []
      while (i < lines.length && /^[A-Za-z][A-Za-z0-9\s()\/-]{1,40}:\s+.+$/.test(lines[i].trim())) {
        const current = cleanInline(lines[i].trim())
        const sepIdx = current.indexOf(":")
        rows.push({ key: current.slice(0, sepIdx).trim(), value: current.slice(sepIdx + 1).trim() })
        i += 1
      }
      blocks.push({ type: "kv", rows })
      continue
    }

    const paragraph = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith("```")) {
      paragraph.push(lines[i]); i += 1
    }
    blocks.push({ type: "p", content: cleanInline(paragraph.join(" ")) })
  }

  return (
    <div className="space-y-2.5 leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === "code") return (
          <pre key={idx} className="bg-gray-900 text-gray-100 text-xs rounded-xl p-3 overflow-x-auto"><code>{block.content}</code></pre>
        )
        if (block.type === "ul") return (
          <ul key={idx} className="list-disc pl-5 space-y-1">{block.items.map((item, j) => <li key={j}>{cleanInline(item)}</li>)}</ul>
        )
        if (block.type === "ol") return (
          <ol key={idx} className="list-decimal pl-5 space-y-1">{block.items.map((item, j) => <li key={j}>{cleanInline(item)}</li>)}</ol>
        )
        if (block.type === "kv") return (
          <div key={idx} className="rounded-xl border border-purple-100 bg-white/60 p-3 space-y-1.5">
            {block.rows.map((row, j) => (
              <div key={j} className="grid grid-cols-[120px_1fr] gap-2 text-[0.92rem]">
                <span className="text-gray-500 font-medium">{row.key}</span>
                <span className="text-gray-800">{row.value}</span>
              </div>
            ))}
          </div>
        )
        return <p key={idx} className="text-[0.93rem]">{cleanInline(block.content)}</p>
      })}
    </div>
  )
}

function UserMessage({ content }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-purple-200/90">You</div>
      <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  )
}

const SUGGESTIONS = [
  "What can you do?",
  "What projects should I focus on right now?",
  "Are there any key things from this document?",
]

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
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
        if (event.results[i].isFinal) finalTranscript += value
        else interim += value
      }
      transcriptRef.current = `${transcriptRef.current} ${finalTranscript}`.trim()
      setQuestion(`${transcriptRef.current} ${interim}`.trim())
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => { setIsListening(false); transcriptRef.current = ""; setStatus("Voice input failed.") }
    recognitionRef.current = recognition
    return () => { recognition.stop(); recognitionRef.current = null }
  }, [])

  useEffect(() => {
    if (!uuid) return
    let cancelled = false
    let timerId = null

    const pollStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/document-status/${uuid}`, { headers: { ...getAuthHeaders() } })
        if (cancelled) return
        const nextStatus = res.data.index_status
        if (nextStatus === "completed") { setDocumentReady(true); setStatus("Document ready. Ask anything!"); return }
        if (nextStatus === "failed") { setDocumentReady(false); setStatus(`Indexing failed: ${res.data.error_message || "Unknown error"}`); return }
        setDocumentReady(false)
        setStatus("Indexing in progress...")
        timerId = setTimeout(pollStatus, 2000)
      } catch (error) {
        if (cancelled) return
        setDocumentReady(false)
        setStatus(`Status check failed: ${formatError(error, "Unknown error")}`)
        timerId = setTimeout(pollStatus, 3000)
      }
    }

    pollStatus()
    return () => { cancelled = true; if (timerId) clearTimeout(timerId) }
  }, [uuid])

  const uploadFile = async () => {
    if (!file) { setStatus("Select a PDF before uploading."); return }
    setStatus("Uploading...")
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData, { headers: { ...getAuthHeaders() } })
      setDocumentReady(false)
      setUuid(res.data.document_id)
      setStatus("Document uploaded. Indexing in progress...")
    } catch (error) {
      setStatus(`Upload failed: ${formatError(error, "Unknown upload error")}`)
    }
  }

  const askQuestion = async (overrideQuestion) => {
    const q = overrideQuestion || question
    if (!q || !uuid) return
    if (!documentReady) { setStatus("Please wait. Document indexing is still in progress."); return }

    setLoading(true)
    setStatus("")
    const userText = q
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
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ question: userText, document_id: uuid }),
      })

      if (!res.ok) { const body = await res.text(); throw new Error(body || `HTTP ${res.status}`) }
      if (!res.body) throw new Error("No response stream received")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue
        setMessages((prev) => prev.map((msg) => msg.id === assistantId ? { ...msg, content: `${msg.content}${chunk}` } : msg))
      }
    } catch (error) {
      setMessages((prev) => prev.map((msg) => msg.id === assistantId ? { ...msg, content: `Request failed: ${formatError(error, "Unknown error")}` } : msg))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion() }
  }

  const showInitial = messages.length === 0

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-3xl">

        {/* Main Card */}
        <div className="glass-card rounded-[28px] p-6 sm:p-8">

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
              Ask our AI anything
            </h1>
            <p className="text-gray-500 mt-2 text-sm">Upload a document and get intelligent answers</p>
          </div>

          {/* Upload Bar */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl bg-white/50 border border-purple-100/50">
            <label className="flex-1 flex items-center gap-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>{file ? file.name : "Choose a PDF file"}</span>
              <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
            </label>
            <button
              onClick={uploadFile}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium px-5 py-2 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Upload
            </button>
          </div>

          {/* Status */}
          {status && (
            <div className="text-xs text-center text-gray-500 mb-4 animate-fade-in">{status}</div>
          )}

          {/* Chat Area */}
          <div className="min-h-[280px] max-h-[400px] overflow-y-auto mb-5 px-1">
            {showInitial ? (
              <div className="flex flex-col items-center justify-center h-[280px] animate-fade-in">
                <div className="animate-float mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-5">Suggestions to start with</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setQuestion(s); if (uuid && documentReady) askQuestion(s) }}
                      className="text-xs px-4 py-2 rounded-full bg-white/70 border border-purple-100 text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-200/50"
                          : "bg-white/70 text-gray-800 border border-purple-100/50 shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        msg.content ? <AssistantMessage content={msg.content} /> : <div className="animate-shimmer h-4 w-32 rounded-lg" />
                      ) : (
                        <UserMessage content={msg.content} />
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="flex gap-1.5 px-4 py-3">
                      <span className="w-2 h-2 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/60 border border-purple-100/40 input-glow transition-all">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything from your document..."
              className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm px-3 py-2"
            />

            <button
              onClick={isListening ? () => { recognitionRef.current?.stop(); setIsListening(false) } : () => { if (!recognitionRef.current) return; transcriptRef.current = ""; setIsListening(true); recognitionRef.current.start() }}
              disabled={loading}
              title={isListening ? "Stop voice" : "Voice input"}
              className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${
                isListening
                  ? "bg-red-400 hover:bg-red-500 text-white animate-pulse"
                  : "bg-purple-100 hover:bg-purple-200 text-purple-600"
              } disabled:opacity-40`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
                <path d="M17 11a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.1A5 5 0 0 0 17 11Z" />
              </svg>
            </button>

            <button
              onClick={() => askQuestion()}
              disabled={!uuid || !documentReady || loading}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-md hover:shadow-lg active:scale-[0.95] disabled:opacity-40 disabled:shadow-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by DocuMind AI
        </p>
      </div>
    </div>
  )
}
