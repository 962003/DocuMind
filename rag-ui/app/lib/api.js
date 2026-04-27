"use client"

import axios from "axios"

import { logoutAndRedirect } from "./auth"

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "")

export function handleAuthError(error) {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    logoutAndRedirect()
    return true
  }
  return false
}

export function formatError(error, fallback) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg.replace(/^Value error,\s*/, "")
    }
    return error.message || fallback
  }
  return error?.message || fallback
}
