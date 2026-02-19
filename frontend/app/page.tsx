import AskCard from "../src/features/document-chat/ask-card";
import { DocumentChatProvider } from "../src/features/document-chat/document-chat-provider";
import UploadCard from "../src/features/document-chat/upload-card";
import { appConfig } from "../src/lib/config";

const BACKEND_URL = appConfig.backendUrl;
const FRONTEND_URL = appConfig.frontendUrl;

async function getBackendStatus() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    return {
      reachable: response.ok,
      label: response.ok ? "Reachable" : `Error ${response.status}`,
    };
  } catch {
    return {
      reachable: false,
      label: "Unreachable",
    };
  }
}

export default async function HomePage() {
  const [status] = await Promise.all([getBackendStatus()]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 font-sans text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <section id="hero" data-purpose="hero-section" className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900">RAG Document Chat</h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600">
            Upload one PDF and ask questions scoped to that document UUID. Leverage retrieval-augmented generation for precise, grounded answers.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">Backend: {BACKEND_URL}</span>
            <span className={`rounded-full px-3 py-1 ${status.reachable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              Status: {status.label}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Frontend: {FRONTEND_URL}</span>
          </div>
        </section>

        <DocumentChatProvider backendUrl={BACKEND_URL}>
          <UploadCard />
          <AskCard />
        </DocumentChatProvider>
        <footer className="pb-12 text-center text-sm text-slate-400">
          <p>© 2026 RAG Document Chat Systems. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
