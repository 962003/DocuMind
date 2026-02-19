const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_FRONTEND_URL = "http://127.0.0.1:3000";

export const appConfig = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL,
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || DEFAULT_FRONTEND_URL,
};
