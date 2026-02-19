import type { ApiError, AskRequest, AskResponse, UploadResponse } from "../types/rag";

const errorFromResponse = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiError;
    return payload.detail || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
};

export const uploadPdf = async (backendUrl: string, file: File): Promise<UploadResponse> => {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${backendUrl}/upload`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(await errorFromResponse(response));
  }

  return (await response.json()) as UploadResponse;
};

export const askDocument = async (backendUrl: string, request: AskRequest): Promise<AskResponse> => {
  const response = await fetch(`${backendUrl}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await errorFromResponse(response));
  }

  return (await response.json()) as AskResponse;
};
