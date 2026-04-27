"use client"

import { useRef, useState } from "react"

export default function UploadPanel({ file, setFile, uploadFile, status, documentReady, setShowChat }) {
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.name.toLowerCase().endsWith(".pdf")) setFile(dropped)
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3rem)]">
      <div className="w-full max-w-lg text-center animate-slide-up">
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
