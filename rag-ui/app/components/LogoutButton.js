"use client"

export default function LogoutButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-20 text-xs text-purple-600 bg-white/70 hover:bg-white px-3 py-1.5 rounded-full border border-purple-100/60 shadow-sm transition-all"
    >
      Log out
    </button>
  )
}
