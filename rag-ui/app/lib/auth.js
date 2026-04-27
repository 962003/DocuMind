"use client"

const TOKEN_KEY = "documind_token"

export function getToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
}

export function getAuthHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function logoutAndRedirect() {
  clearToken()
  if (typeof window !== "undefined") window.location.href = "/login"
}
