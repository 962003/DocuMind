"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { askDocument, uploadPdf } from "../../lib/api";

interface DocumentChatContextValue {
  backendUrl: string;
  file: File | null;
  documentId: string;
  question: string;
  lastQuestion: string;
  answer: string;
  uploadStatus: string;
  isUploading: boolean;
  isAsking: boolean;
  canAsk: boolean;
  hasDocument: boolean;
  setFile: (file: File | null) => void;
  setQuestion: (value: string) => void;
  upload: (selectedFile?: File) => Promise<void>;
  ask: () => Promise<void>;
}

const DocumentChatContext = createContext<DocumentChatContextValue | null>(null);

export function DocumentChatProvider({
  backendUrl,
  children,
}: {
  backendUrl: string;
  children: ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [uploadStatus, setUploadStatus] = useState("Ready to upload.");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const hasDocument = documentId.trim().length > 0;

  const canAsk = useMemo(
    () => question.trim().length > 0 && hasDocument && !isAsking && !isUploading,
    [question, hasDocument, isAsking, isUploading],
  );

  const upload = async (selectedFile?: File) => {
    const activeFile = selectedFile ?? file;

    if (!activeFile || activeFile.size === 0) {
      setUploadStatus("Select a PDF file first.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading and indexing document...");

    try {
      const response = await uploadPdf(backendUrl, activeFile);
      setFile(activeFile);
      setDocumentId(response.document_id);
      setLastQuestion("");
      setAnswer("");
      setUploadStatus(`Uploaded ${activeFile.name}. Document UUID: ${response.document_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadStatus(`Upload error: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const ask = async () => {
    const trimmedQuestion = question.trim();
    const trimmedDocumentId = documentId.trim();

    if (!trimmedQuestion) {
      return;
    }

    if (!trimmedDocumentId) {
      setAnswer("Upload a document first.");
      return;
    }

    setLastQuestion(trimmedQuestion);
    setAnswer("");
    setQuestion("");
    setIsAsking(true);

    try {
      const response = await askDocument(backendUrl, {
        document_id: trimmedDocumentId,
        question: trimmedQuestion,
      });
      setAnswer(response.answer || "No answer returned.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch answer";
      setAnswer(`Error: ${message}`);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <DocumentChatContext.Provider
      value={{
        backendUrl,
        file,
        documentId,
        question,
        lastQuestion,
        answer,
        uploadStatus,
        isUploading,
        isAsking,
        canAsk,
        hasDocument,
        setFile,
        setQuestion,
        upload,
        ask,
      }}
    >
      {children}
    </DocumentChatContext.Provider>
  );
}

export function useDocumentChat() {
  const context = useContext(DocumentChatContext);
  if (!context) {
    throw new Error("useDocumentChat must be used within DocumentChatProvider");
  }
  return context;
}
