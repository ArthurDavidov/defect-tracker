'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { createDefect, getNextSerialNumber } from '@/lib/firebase/firestore'
import { ChevronRight } from 'lucide-react'
import type { DefectSeverity, DefectStatus } from '@/types'

function firestoreErrorMessage(err: any): string {
  const code: string = err?.code ?? ''
  if (code === 'permission-denied')    return 'שגיאת הרשאות – בדוק את חוקי Firestore'
  if (code === 'unavailable')          return 'שרת Firebase אינו זמין – בדוק חיבור לאינטרנט'
  if (code === 'invalid-argument')     return `נתון שגוי: ${err?.message ?? ''}`
  if (code === 'not-found')            return 'הפרויקט לא נמצא – נסה לרענן את הדף'
  if (err?.message)                    return err.message
  return 'שגיאה לא ידועה – נסה שוב'
}

function newUuid(): string {
  try { return crypto.randomUUID() } catch { /* fallback */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function NewDefectPage() {
  const { project } = useProject()
  const { user }    = useAuth()
  const router      = useRouter()

  const [description,        setDescription]        = useState('')
  const [location,           setLocation]           = useState('')
  const [section,            setSection]            = useState('')
  const [severity,           setSeverity]           = useState<DefectSeverity>('major')
  const [status,             setStatus]             = useState<DefectStatus>('open')
  const [estimatedCost,      setEstimatedCost]      = useState('')
  const [contractorPosition, setContractorPosition] = useState('')
  const [tenantPosition,     setTenantPosition]     = useState('')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  if (!project || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const serialNumber = await getNextSerialNumber(project.id)
      const now = new Date().toISOString()

      await createDefect(project.id, {
        projectId:          project.id,
        serialNumber,
        section:            section.trim(),
        location:           location.trim(),
        description:        description.trim(),
        sourceType:         'self',
        severity,
        status,
        // Omit estimatedCost entirely when empty — Firestore rejects undefined values
        ...(estimatedCost ? { estimatedCost: Number(estimatedCost) } : {}),
        contractorPosition: contractorPosition.trim(),
        contractorStatus:   'pending',
        tenantPosition:     tenantPosition.trim(),
        images:             [],
        timeline:           [{
          id:        newUuid(),
          date:      now,
          event:     'ליקוי נוסף ידנית',
          actorName: user.displayName || user.email || '',
        }],
        createdAt: now,
        updatedAt: now,
      })
      router.push('/defects')
    } catch (err: any) {
      setError(firestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/defects" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronRight className="w-4 h-4" /> חזרה לליקויים
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">הוספת ליקוי חדש</h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6">

        <div>
          <label className={labelCls}>תיאור הליקוי <span className="text-red-500">*</span></label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            required rows={3} className={inputCls + ' resize-none'}
            placeholder="תאר את הליקוי בפירוט..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>מיקום <span className="text-red-500">*</span></label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              required className={inputCls} placeholder="מטבח, חדר שינה..." />
          </div>
          <div>
            <label className={labelCls}>סעיף</label>
            <input type="text" value={section} onChange={e => setSection(e.target.value)}
              className={inputCls} placeholder="1.1" dir="ltr" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>חומרה <span className="text-red-500">*</span></label>
            <select value={severity} onChange={e => setSeverity(e.target.value as DefectSeverity)} className={inputCls}>
              <option value="critical">קריטי</option>
              <option value="major">חמור</option>
              <option value="minor">קל</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>סטטוס</label>
            <select value={status} onChange={e => setStatus(e.target.value as DefectStatus)} className={inputCls}>
              <option value="open">פתוח לטיפול</option>
              <option value="in_progress">בטיפול</option>
              <option value="refused">סירוב לתקן</option>
              <option value="closed">בוצע / טופל</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>עלות מוערכת (₪)</label>
          <input type="number" min="0" value={estimatedCost}
            onChange={e => setEstimatedCost(e.target.value)}
            className={inputCls} placeholder="השאר ריק אם לא ידוע" dir="ltr" />
        </div>

        <div>
          <label className={labelCls}>עמדת הקבלן</label>
          <textarea value={contractorPosition} onChange={e => setContractorPosition(e.target.value)}
            rows={2} className={inputCls + ' resize-none'}
            placeholder="מה ענה הקבלן על ליקוי זה..." />
        </div>

        <div>
          <label className={labelCls}>עמדתי / הערות</label>
          <textarea value={tenantPosition} onChange={e => setTenantPosition(e.target.value)}
            rows={2} className={inputCls + ' resize-none'}
            placeholder="הערות אישיות, מעקב, פרטים נוספים..." />
        </div>

        {error && (
          <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="font-medium">שגיאה בשמירת הליקוי</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'שומר...' : 'שמור ליקוי'}
          </button>
          <Link href="/defects"
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium">
            ביטול
          </Link>
        </div>
      </form>
    </div>
  )
}
