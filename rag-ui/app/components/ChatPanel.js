"use client"

import { useEffect, useRef } from "react"

import AssistantMessage from "./messages/AssistantMessage"
import UserMessage from "./messages/UserMessage"

const SUGGESTIONS = [
  "What is this document about?",
  "Summarize the key points",
  "What are the main findings?",
]

export default function ChatPanel({
  documentReady,
  question,
  setQuestion,
  messages,
  loading,
  status,
  askQuestion,
  isListening,
  setIsListening,
  recognitionRef,
  transcriptRef,
  activeFilename,
}) {
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion() }
  }

  const showInitial = messages.length === 0

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)] animate-slide-up">
      <div className="flex items-center gap-3 mb-5 px-1">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-200/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-800 leading-tight">
            Docu<span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Mind</span>
          </h2>
          <p className="text-xs text-gray-500 truncate">{activeFilename || "Ask anything about your document"}</p>
        </div>
      </div>

      {status && !documentReady && (
        <div className="text-xs text-center text-gray-500 mb-3 animate-fade-in py-2 px-4 bg-white/50 backdrop-blur-sm rounded-xl border border-purple-100/40">{status}</div>
      )}

      <div className="flex-1 overflow-y-auto mb-4 pr-1">
        {showInitial ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-fade-in">
            <div className="animate-float mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-lg shadow-purple-200/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
            </div>
            <p className="text-gray-600 text-base font-medium mb-2">Ask our AI anything</p>
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
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-purple-200/40"
                    : "bg-white/80 backdrop-blur-sm text-gray-800 border border-purple-100/40 shadow-sm"
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

      <div className="max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/70 backdrop-blur-sm border border-purple-100/40 shadow-md shadow-purple-200/20 input-glow transition-all">
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
        <p className="text-center text-[10px] text-gray-400 mt-3">Powered by DocuMind AI</p>
      </div>
    </div>
  )
}
