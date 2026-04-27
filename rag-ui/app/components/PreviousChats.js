"use client"

import { formatRelativeDate } from "../lib/format"

function PreviousChatsHeader() {
  return (
    <div className="flex items-center gap-2.5 mb-4 px-1">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shadow-md shadow-purple-200/40">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-800 leading-tight">
          Previous <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">chats</span>
        </h3>
        <p className="text-[10px] text-gray-400">Pick up where you left off</p>
      </div>
    </div>
  )
}

export default function PreviousChats({ documents, loading, onOpen, activeId, onNewChat }) {
  return (
    <aside className="rounded-[28px] p-5 self-start lg:sticky lg:top-6">
      <PreviousChatsHeader />

      <button
        onClick={onNewChat}
        className="w-full mb-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-semibold shadow-md shadow-purple-200/40 hover:shadow-lg hover:shadow-purple-300/40 transition-all flex items-center justify-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New chat
      </button>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="animate-shimmer h-[52px] rounded-2xl" />
          ))}
        </div>
      ) : !documents.length ? (
        <div className="rounded-2xl border border-dashed border-purple-200/60 px-4 py-6 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">No chats yet.</p>
          <p className="text-[11px] text-gray-400 mt-1">Upload a PDF to get started.</p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          {documents.map((doc) => {
            const isActive = doc.document_id === activeId
            const isReady = doc.index_status === "completed"
            return (
              <li key={doc.document_id}>
                <button
                  onClick={() => onOpen(doc)}
                  disabled={!isReady}
                  className={`group w-full text-left px-3 py-2.5 rounded-2xl border transition-all flex items-center gap-3 ${
                    isActive
                      ? "bg-white/40 border-purple-200 shadow-sm shadow-purple-200/30"
                      : "bg-transparent border-purple-100/40 hover:bg-white/30 hover:border-purple-200/70"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  title={isReady ? "Open chat" : `Status: ${doc.index_status}`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-gradient-to-br from-purple-400 to-pink-400 text-white shadow-md shadow-purple-200/50"
                      : "bg-purple-50 text-purple-500 group-hover:bg-gradient-to-br group-hover:from-purple-400 group-hover:to-pink-400 group-hover:text-white"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-700 truncate">{doc.filename}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-gray-400">{formatRelativeDate(doc.uploaded_at)}</p>
                      {!isReady && (
                        <span className="text-[9px] uppercase tracking-wide text-purple-500 bg-purple-100/80 px-1.5 py-0.5 rounded-full">
                          {doc.index_status}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
