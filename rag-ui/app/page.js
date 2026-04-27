"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"

import { clearToken, getAuthHeaders, getToken, logoutAndRedirect } from "./lib/auth"
import { API_BASE_URL, formatError, handleAuthError } from "./lib/api"
import ChatPanel from "./components/ChatPanel"
import LogoutButton from "./components/LogoutButton"
import PreviousChats from "./components/PreviousChats"
import UploadPanel from "./components/UploadPanel"

export default function Home() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [file, setFile] = useState(null)
  const [uuid, setUuid] = useState(null)
  const [documentReady, setDocumentReady] = useState(false)
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  const recognitionRef = useRef(null)
  const transcriptRef = useRef("")

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
      return
    }
    setAuthReady(true)
  }, [router])

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const res = await axios.get(`${API_BASE_URL}/documents`, { headers: { ...getAuthHeaders() } })
      setDocuments(res.data?.documents || [])
    } catch (error) {
      if (handleAuthError(error)) return
    } finally {
      setDocumentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    fetchDocuments()
  }, [authReady, fetchDocuments])

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
        if (handleAuthError(error)) return
        setDocumentReady(false)
        setStatus(`Status check failed: ${formatError(error, "Unknown error")}`)
        timerId = setTimeout(pollStatus, 3000)
      }
    }

    pollStatus()
    return () => { cancelled = true; if (timerId) clearTimeout(timerId) }
  }, [uuid])

  const loadHistoryMessages = useCallback(async (documentId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/ask/history/${documentId}`, { headers: { ...getAuthHeaders() } })
      const turns = res.data?.turns || []
      const built = []
      turns.forEach((turn) => {
        if (turn.question) built.push({ id: `user-${turn.id}`, role: "user", content: turn.question })
        if (turn.answer) built.push({ id: `assistant-${turn.id}`, role: "assistant", content: turn.answer })
      })
      setMessages(built)
    } catch (error) {
      if (handleAuthError(error)) return
      setMessages([])
    }
  }, [])

  const openPreviousDocument = useCallback(async (doc) => {
    if (!doc || doc.index_status !== "completed") return
    setFile(null)
    setUuid(doc.document_id)
    setDocumentReady(true)
    setStatus("")
    setQuestion("")
    await loadHistoryMessages(doc.document_id)
    setShowChat(true)
  }, [loadHistoryMessages])

  const startNewChat = useCallback(() => {
    setShowChat(false)
    setFile(null)
    setUuid(null)
    setDocumentReady(false)
    setMessages([])
    setQuestion("")
    setStatus("")
    fetchDocuments()
  }, [fetchDocuments])

  const uploadFile = async () => {
    if (!file) { setStatus("Select a PDF before uploading."); return }
    setStatus("Uploading & analyzing...")
    setMessages([])
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData, { headers: { ...getAuthHeaders() } })
      setDocumentReady(false)
      setUuid(res.data.document_id)
      setStatus("Analyzing your document...")
      fetchDocuments()
    } catch (error) {
      if (handleAuthError(error)) return
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

      if (res.status === 401) {
        logoutAndRedirect()
        return
      }
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

  const handleLogout = () => {
    clearToken()
    router.replace("/login")
  }

  if (!authReady) return null

  const activeFilename = documents.find((doc) => doc.document_id === uuid)?.filename

  return (
    <main className="relative min-h-screen">
      <div className="fixed inset-0 center-glow pointer-events-none" />

      <LogoutButton onClick={handleLogout} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[300px_1px_1fr] gap-6 items-stretch">
        <PreviousChats
          documents={documents}
          loading={documentsLoading}
          onOpen={openPreviousDocument}
          activeId={uuid}
          onNewChat={startNewChat}
        />

        <div
          className="hidden lg:block w-px self-stretch rounded-full"
          style={{
            background:
              "linear-gradient(to bottom, rgba(216,180,254,0) 0%, rgba(216,180,254,0.7) 20%, rgba(244,114,182,0.7) 80%, rgba(244,114,182,0) 100%)",
          }}
          aria-hidden="true"
        />

        <section className="min-w-0">
          {showChat ? (
            <ChatPanel
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
              activeFilename={activeFilename}
            />
          ) : (
            <UploadPanel
              file={file}
              setFile={setFile}
              uploadFile={uploadFile}
              status={status}
              documentReady={documentReady}
              setShowChat={setShowChat}
            />
          )}
        </section>
      </div>
    </main>
  )
}
