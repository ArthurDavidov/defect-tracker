'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const router = useRouter()

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signUp(email, password, name)
      router.push('/setup')   // go create the apartment project
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? 'כתובת האימייל כבר בשימוש'
        : 'שגיאה ביצירת החשבון')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900">יצירת חשבון</h1>
          <p className="text-gray-500 text-sm mt-1">נתחיל עם פרטים בסיסיים</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              required className={inputCls} placeholder="ישראל ישראלי"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required dir="ltr" className={inputCls} placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה (לפחות 6 תווים)</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={6} dir="ltr" className={inputCls} placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'יוצר חשבון...' : 'צור חשבון'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          כבר יש לך חשבון?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">התחבר</Link>
        </p>
      </div>
    </div>
  )
}
