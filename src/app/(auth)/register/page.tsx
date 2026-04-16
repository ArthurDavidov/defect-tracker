'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { createProject } from '@/lib/firebase/firestore'
import { warrantyEndDate } from '@/lib/utils'

export default function RegisterPage() {
  const { signUp, user } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Step 1 — account
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  // Step 2 — apartment
  const [address,      setAddress]      = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')

  // When Firebase auth resolves (async), jump to step 2 if already signed in
  useEffect(() => {
    if (user) {
      setStep(2)
      setName(user.displayName ?? '')
      setEmail(user.email ?? '')
    }
  }, [user])

  const handleAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signUp(email, password, name)
      setStep(2)
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? 'כתובת האימייל כבר בשימוש'
        : 'שגיאה ביצירת החשבון')
    } finally {
      setLoading(false)
    }
  }

  const handleProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(''); setLoading(true)
    try {
      await createProject({
        name:            `דירה – ${address}`,
        address,
        ownerId:         user.uid,
        deliveryDate,
        warrantyEndDate: warrantyEndDate(deliveryDate),
        members:         [{ userId: user.uid, email: user.email!, name: user.displayName || name, role: 'owner' }],
      })
      router.push('/dashboard')
    } catch {
      setError('שגיאה ביצירת הפרויקט')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className={`flex items-center gap-2 ${s < step ? 'text-green-600' : s === step ? 'text-blue-600' : 'text-gray-300'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                ${s < step ? 'bg-green-600 border-green-600 text-white' : s === step ? 'border-blue-600 text-blue-600' : 'border-gray-200 text-gray-300'}`}>
                {s < step ? '✓' : s}
              </div>
              <span className="text-xs font-medium hidden sm:block">
                {s === 1 ? 'יצירת חשבון' : 'פרטי הדירה'}
              </span>
              {s < 2 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">יצירת חשבון</h1>
              <p className="text-gray-500 text-sm mt-1">נתחיל עם פרטים בסיסיים</p>
            </div>
            <form onSubmit={handleAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls} placeholder="ישראל ישראלי" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required dir="ltr" className={inputCls} placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה (לפחות 6 תווים)</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} dir="ltr" className={inputCls} placeholder="••••••••" />
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'יוצר חשבון...' : 'המשך'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">פרטי הדירה</h1>
              <p className="text-gray-500 text-sm mt-1">נצטרך את תאריך המסירה לחישוב שנת הבדק</p>
            </div>
            <form onSubmit={handleProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">כתובת הדירה</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className={inputCls} placeholder="הגיבור 1, הוד השרון" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תאריך מסירת הדירה</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required dir="ltr" className={inputCls} />
                {deliveryDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    שנת בדק מסתיימת: <strong>{warrantyEndDate(deliveryDate)}</strong>
                  </p>
                )}
              </div>
              {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'יוצר...' : 'סיים הרשמה'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          כבר יש לך חשבון?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">התחבר</Link>
        </p>
      </div>
    </div>
  )
}
