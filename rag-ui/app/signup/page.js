"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"

import { getToken, setToken } from "../lib/auth"
import { API_BASE_URL, formatError } from "../lib/api"

const PASSWORD_RULES_TEXT =
  "At least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character."

const validatePassword = (pwd) => {
  if (pwd.length < 8) return "Password must be at least 8 characters"
  if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter"
  if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter"
  if (!/\d/.test(pwd)) return "Password must include a number"
  if (!/[!@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]/.test(pwd))
    return "Password must include a special character"
  return ""
}

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (getToken()) router.replace("/")
  }, [router])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Name is required")
      return
    }
    const pwdError = validatePassword(password)
    if (pwdError) {
      setError(pwdError)
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setSubmitting(true)
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/signup`, {
        name: name.trim(),
        email,
        password,
        confirm_password: confirmPassword,
      })
      setToken(res.data.access_token)
      router.replace("/")
    } catch (err) {
      setError(formatError(err, "Signup failed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="fixed inset-0 center-glow pointer-events-none" />
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="animate-float mb-5">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-400 via-pink-400 to-purple-500 flex items-center justify-center shadow-xl shadow-purple-200/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">
            Docu<span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Mind</span>
          </h2>
          <p className="text-gray-500 text-xs mt-1">AI-powered document chat</p>
        </div>

        <div className="glass-card rounded-[28px] p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Create <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">account</span>
          </h1>
          <p className="text-gray-500 text-sm mb-6">Start chatting with your documents</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-purple-100/40 outline-none text-sm text-gray-700 focus:border-purple-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-purple-100/40 outline-none text-sm text-gray-700 focus:border-purple-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-purple-100/40 outline-none text-sm text-gray-700 focus:border-purple-300"
              />
              <p className="text-[11px] text-gray-400 mt-1">{PASSWORD_RULES_TEXT}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-purple-100/40 outline-none text-sm text-gray-700 focus:border-purple-300"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-sm shadow-lg shadow-purple-200/40 transition-all disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create account"}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-5">
            Already have an account?{" "}
            <a href="/login" className="text-purple-600 hover:text-purple-700 font-medium">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
