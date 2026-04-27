"use client"

import { cleanAssistantContent, cleanInline } from "../../lib/format"

export default function AssistantMessage({ content }) {
  const lines = cleanAssistantContent(content).split("\n")
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }

    if (line.trim().startsWith("```")) {
      const code = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i += 1 }
      blocks.push({ type: "code", content: code.join("\n") })
      if (i < lines.length) i += 1
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i += 1 }
      blocks.push({ type: "ul", items })
      continue
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(cleanInline(lines[i].trim().replace(/^\d+\.\s+/, ""))); i += 1 }
      blocks.push({ type: "ol", items })
      continue
    }

    if (/^[A-Za-z][A-Za-z0-9\s()\/-]{1,40}:\s+.+$/.test(line.trim())) {
      const rows = []
      while (i < lines.length && /^[A-Za-z][A-Za-z0-9\s()\/-]{1,40}:\s+.+$/.test(lines[i].trim())) {
        const current = cleanInline(lines[i].trim())
        const sepIdx = current.indexOf(":")
        rows.push({ key: current.slice(0, sepIdx).trim(), value: current.slice(sepIdx + 1).trim() })
        i += 1
      }
      blocks.push({ type: "kv", rows })
      continue
    }

    const paragraph = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith("```")) {
      paragraph.push(lines[i]); i += 1
    }
    blocks.push({ type: "p", content: cleanInline(paragraph.join(" ")) })
  }

  return (
    <div className="space-y-2.5 leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === "code") return (
          <pre key={idx} className="bg-gray-900 text-gray-100 text-xs rounded-xl p-3 overflow-x-auto"><code>{block.content}</code></pre>
        )
        if (block.type === "ul") return (
          <ul key={idx} className="list-disc pl-5 space-y-1">{block.items.map((item, j) => <li key={j}>{cleanInline(item)}</li>)}</ul>
        )
        if (block.type === "ol") return (
          <ol key={idx} className="list-decimal pl-5 space-y-1">{block.items.map((item, j) => <li key={j}>{cleanInline(item)}</li>)}</ol>
        )
        if (block.type === "kv") return (
          <div key={idx} className="rounded-xl border border-purple-100 bg-white/60 p-3 space-y-1.5">
            {block.rows.map((row, j) => (
              <div key={j} className="grid grid-cols-[120px_1fr] gap-2 text-[0.92rem]">
                <span className="text-gray-500 font-medium">{row.key}</span>
                <span className="text-gray-800">{row.value}</span>
              </div>
            ))}
          </div>
        )
        return <p key={idx} className="text-[0.93rem]">{cleanInline(block.content)}</p>
      })}
    </div>
  )
}
