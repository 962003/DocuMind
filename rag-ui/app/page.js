"use client"

import { useEffect, useRef, useState } from "react"
import axios from "axios"

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
const BACKEND_API_KEY = process.env.NEXT_PUBLIC_BACKEND_API_KEY || ""

function getAuthHeaders() {
  return BACKEND_API_KEY ? { "x-api-key": BACKEND_API_KEY } : {}
}

function formatError(error, fallback) {
  if (axios.isAxiosError(error)) return error.response?.data?.detail || error.message || fallback
  return fallback
}

function cleanAssistantContent(value) {
  return String(value || "").replace(/\*\*/g, "").replace(/LLM request failed:[\s\S]*$/i, "").trim()
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
  "What is this document about?",
  "Summarize the key points",
  "What are the main findings?",
]

/* ─── Upload Screen ─── */
function UploadScreen({ file, setFile, uploadFile, status, documentReady, setShowChat }) {
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.name.toLowerCase().endsWith(".pdf")) setFile(dropped)
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      {/* Center gradient glow */}
      <div className="fixed inset-0 center-glow pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg text-center animate-slide-up">
        {/* Logo */}
        <div className="animate-float mb-8 inline-block">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500 flex items-center justify-center shadow-xl shadow-purple-200/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-3">
          Docu<span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Mind</span>
        </h1>
        <p className="text-gray-500 mb-10 text-base">Upload a PDF and start asking questions with AI</p>

        {/* Drop Zone */}
        <div
          ref={dragRef}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`upload-zone rounded-3xl p-10 mb-6 cursor-pointer transition-all ${dragging ? "border-purple-400 bg-purple-50/40 scale-[1.01]" : ""}`}
          onClick={() => dragRef.current?.querySelector("input")?.click()}
        >
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} className="hidden" />

          {file ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium text-sm">{file.name}</p>
              <p className="text-gray-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium text-sm">Drop your PDF here or click to browse</p>
              <p className="text-gray-400 text-xs">Maximum 25 MB</p>
            </div>
          )}
        </div>

        {/* Upload / Start Chat Button */}
        {documentReady ? (
          <button
            onClick={() => setShowChat(true)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-base transition-all shadow-lg shadow-green-200/40 hover:shadow-xl hover:shadow-green-300/40 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Start Chat
          </button>
        ) : (
          <button
            onClick={uploadFile}
            disabled={!file}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-base transition-all shadow-lg shadow-purple-200/40 hover:shadow-xl hover:shadow-purple-300/40 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            Upload & Analyze
          </button>
        )}

        {status && (
          <p className={`text-sm mt-4 animate-fade-in ${documentReady ? "text-green-600 font-medium" : "text-gray-500"}`}>{status}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Chat Screen ─── */
function ChatScreen({ uuid, documentReady, question, setQuestion, messages, loading, status, askQuestion, isListening, setIsListening, recognitionRef, transcriptRef }) {
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion() }
  }

  const showInitial = messages.length === 0

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-6">
      <div className="fixed inset-0 center-glow pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl animate-slide-up">
        <div className="glass-card rounded-[28px] p-5 sm:p-7">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Docu<span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Mind</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Ask anything about your document</p>
            </div>
            {documentReady && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Ready
              </span>
            )}
          </div>

          {status && !documentReady && (
            <div className="text-xs text-center text-gray-500 mb-3 animate-fade-in py-2 px-4 bg-purple-50/50 rounded-xl">{status}</div>
          )}

          {/* Chat Area */}
          <div className="min-h-[320px] max-h-[450px] overflow-y-auto mb-4 px-1">
            {showInitial ? (
              <div className="flex flex-col items-center justify-center h-[320px] animate-fade-in">
                <div className="animate-float mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg shadow-purple-200/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-2">Ask our AI anything</p>
                <p className="text-gray-400 text-xs mb-6">Suggestions to start with</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setQuestion(s); if (documentReady) askQuestion(s) }}
                      className="text-xs px-4 py-2 rounded-full bg-white/80 border border-purple-100/60 text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-200/40"
                        : "bg-white/80 text-gray-800 border border-purple-100/40 shadow-sm"
                    }`}>
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
                isListening ? "bg-red-400 hover:bg-red-500 text-white animate-pulse" : "bg-purple-50 hover:bg-purple-100 text-purple-500"
              } disabled:opacity-40`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
                <path d="M17 11a1 1 0 1 0-2 0 3 3 0 1 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.1A5 5 0 0 0 17 11Z" />
              </svg>
            </button>
            <button
              onClick={() => askQuestion()}
              disabled={!documentReady || loading || !question.trim()}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-md hover:shadow-lg active:scale-[0.95] disabled:opacity-40 disabled:shadow-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Powered by DocuMind AI</p>
      </div>
    </div>
  )
}

/* ─── Main App ─── */
export default function Home() {
  const [file, setFile] = useState(null)
  const [uuid, setUuid] = useState(null)
  const [documentReady, setDocumentReady] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [showChat, setShowChat] = useState(false)

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
        if (event.results[i].isFinal) finalTranscript += value
        else interim += value
      }
      transcriptRef.current = `${transcriptRef.current} ${finalTranscript}`.trim()
      setQuestion(`${transcriptRef.current} ${interim}`.trim())
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => { setIsListening(false); transcriptRef.current = "" }
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
        if (nextStatus === "completed") {
          setDocumentReady(true)
          setStatus("Document ready! Click Start Chat to begin.")
          return
        }
        if (nextStatus === "failed") {
          setDocumentReady(false)
          setStatus(`Indexing failed: ${res.data.error_message || "Unknown error"}`)
          return
        }
        setDocumentReady(false)
        setStatus("Analyzing your document...")
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
    setStatus("Uploading & analyzing...")
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData, { headers: { ...getAuthHeaders() } })
      setDocumentReady(false)
      setUuid(res.data.document_id)
      setStatus("Analyzing your document...")
    } catch (error) {
      setStatus(`Upload failed: ${formatError(error, "Unknown upload error")}`)
    }
  }

  const askQuestion = async (overrideQuestion) => {
    const q = overrideQuestion || question
    if (!q || !uuid || !documentReady) return

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

  if (!showChat) {
    return <UploadScreen file={file} setFile={setFile} uploadFile={uploadFile} status={status} documentReady={documentReady} setShowChat={setShowChat} />
  }

  return (
    <ChatScreen
      uuid={uuid}
      documentReady={documentReady}
      question={question}
      setQuestion={setQuestion}
      messages={messages}
      loading={loading}
      status={status}
      askQuestion={askQuestion}
      isListening={isListening}
      setIsListening={setIsListening}
      recognitionRef={recognitionRef}
      transcriptRef={transcriptRef}
    />
  )
}
