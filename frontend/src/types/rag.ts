export interface UploadResponse {
  document_id: string;
}

export interface AskRequest {
  document_id: string;
  question: string;
}

export interface AskResponse {
  answer: string;
}

export interface ApiError {
  detail?: string;
}
