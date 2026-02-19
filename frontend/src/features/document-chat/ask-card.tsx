"use client";

import { FormEvent } from "react";
import { useDocumentChat } from "./document-chat-provider";

export default function AskCard() {
  const { question, lastQuestion, answer, hasDocument, isAsking, canAsk, setQuestion, ask } = useDocumentChat();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await ask();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 p-6">
        <h2 className="text-xl font-bold text-slate-800 text-center">Chat</h2>
        <p className="text-sm text-slate-500 text-center">Ask grounded questions against the selected document UUID.</p>
      </div>

      <div className="space-y-8 p-8">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
          <div className="relative flex-1">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={hasDocument ? "Ask about this document..." : "Upload document first..."}
              disabled={!hasDocument}
              className="w-full rounded-xl border-slate-200 py-3 pl-12 pr-12 text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="button"
              title="Upload document"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-indigo-600"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
          <button
            type="submit"
            disabled={!canAsk || isAsking}
            className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAsking ? "Asking..." : "Ask"}
          </button>
        </form>

        <div className="space-y-6">
          {lastQuestion ? (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">User question</h3>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-slate-800 shadow-sm">
                <p>{lastQuestion}</p>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">AI response</h3>
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-slate-800 shadow-sm">
              {answer ? (
                <pre className="whitespace-pre-wrap break-words leading-relaxed">{answer}</pre>
              ) : (
                <p className="italic text-slate-500">No response yet. Please upload a document and ask a question.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
