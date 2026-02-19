"use client";

import { FormEvent } from "react";
import { useDocumentChat } from "./document-chat-provider";

export default function UploadCard() {
  const { file, documentId, upload, isUploading, uploadStatus, setFile } = useDocumentChat();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await upload();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 p-6">
        <h2 className="text-xl font-bold text-slate-800 text-center py-8">Upload</h2>
        <p className="text-sm text-slate-500 text-center">Upload a single PDF and use its UUID for scoped retrieval.</p>
      </div>
      <div className="space-y-6 p-8">
        {/* PDF File Heading and Input */}
        <div>
          <h3 className="mb-2 text-base font-semibold text-slate-700">PDF File</h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-full flex-1">
              {!file ? (
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-slate-200 p-1 text-sm text-slate-500 transition-colors file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
              ) : (
                <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  Selected file: {file.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Upload Document Heading and Form */}
        <div>
          <form className="flex flex-col gap-2" onSubmit={onSubmit}>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="w-full rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isUploading ? "Uploading..." : "Submit"}
            </button>
            <div
              className={`rounded-lg border px-4 py-2 text-sm italic ${
                uploadStatus.startsWith("Upload error")
                  ? "border-rose-100 bg-rose-50 text-rose-700"
                  : uploadStatus.startsWith("Uploaded")
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-blue-100 bg-blue-50 text-blue-700"
              }`}
            >
              {uploadStatus}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
