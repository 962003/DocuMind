export function cleanAssistantContent(value) {
  return String(value || "").replace(/\*\*/g, "").replace(/LLM request failed:[\s\S]*$/i, "").trim()
}

export function cleanInline(value) {
  return String(value || "").replace(/\*\*/g, "").trim()
}

export function formatRelativeDate(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
