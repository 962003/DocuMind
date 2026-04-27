"use client"

export default function UserMessage({ content }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-purple-200/90">You</div>
      <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  )
}
