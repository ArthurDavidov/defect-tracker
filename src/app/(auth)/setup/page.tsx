'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProject } from '@/contexts/ProjectContext'
import { createProject } from '@/lib/firebase/firestore'
import { warrantyEndDate } from '@/lib/utils'

/**
 * Apartment setup page — shown to authenticated users who don't have a project yet.
 * Only contains the apartment form (no account-creation step).
 */
export default function SetupPage() {
  const { user, loading: authLoading } = useAuth()
  const { refreshProject } = useProject()
  const router = useRouter()

  const [address,      setAddress]      = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await createProject({
        name:            `דירה – ${address}`,
        address,
        ownerId:         user.uid,
        deliveryDate,
        warrantyEndDate: warrantyEndDate(deliveryDate),
        members:         [{ userId: user.uid, email: user.email!, name: user.displayName || '', role: 'owner' }],
      })
      await refreshProject()   // update context before navigating
      router.push('/dashboard')
    } catch {
      setError('שגיאה ביצירת הפרויקט – נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900">פרטי הדירה</h1>
          <p className="text-gray-500 text-sm mt-1">
            שלום {user.displayName || user.email}! נצטרך עוד פרט אחד לפני שנתחיל
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כתובת הדירה</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              required
              className={inputCls}
              placeholder="הגיבור 1, הוד השרון"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תאריך מסירת הדירה</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              required
              dir="ltr"
              className={inputCls}
            />
            {deliveryDate && (
              <p className="text-xs text-gray-500 mt-1">
                שנת בדק מסתיימת: <strong>{warrantyEndDate(deliveryDate)}</strong>
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'יוצר...' : 'סיים הרשמה'}
          </button>
        </form>
      </div>
    </div>
  )
}
