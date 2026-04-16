'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { createDefect, getNextSerialNumber } from '@/lib/firebase/firestore'
import { ChevronRight } from 'lucide-react'
import type { DefectSeverity, DefectStatus } from '@/types'

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
        estimatedCost:      estimatedCost ? Number(estimatedCost) : undefined,
        contractorPosition: contractorPosition.trim(),
        contractorStatus:   'pending',
        tenantPosition:     tenantPosition.trim(),
        images:             [],
        timeline:           [{
          id:        crypto.randomUUID(),
          date:      now,
          event:     'ליקוי נוסף ידנית',
          actorName: user.displayName || user.email || '',
        }],
        createdAt: now,
        updatedAt: now,
      })
      router.push('/defects')
    } catch {
      setError('שגיאה בשמירת הליקוי – נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link href="/defects" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronRight className="w-4 h-4" /> חזרה לליקויים
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">הוספת ליקוי חדש</h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6">

        {/* Description */}
        <div>
          <label className={labelCls}>תיאור הליקוי <span className="text-red-500">*</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required rows={3}
            className={inputCls + ' resize-none'}
            placeholder="תאר את הליקוי בפירוט..."
          />
        </div>

        {/* Location + Section */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>מיקום <span className="text-red-500">*</span></label>
            <input
              type="text" value={location} onChange={e => setLocation(e.target.value)}
              required className={inputCls} placeholder="מטבח, חדר שינה..."
            />
          </div>
          <div>
            <label className={labelCls}>סעיף</label>
            <input
              type="text" value={section} onChange={e => setSection(e.target.value)}
              className={inputCls} placeholder="1.1" dir="ltr"
            />
          </div>
        </div>

        {/* Severity + Status */}
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

        {/* Estimated cost */}
        <div>
          <label className={labelCls}>עלות מוערכת (₪)</label>
          <input
            type="number" min="0" value={estimatedCost}
            onChange={e => setEstimatedCost(e.target.value)}
            className={inputCls} placeholder="0" dir="ltr"
          />
        </div>

        {/* Contractor position */}
        <div>
          <label className={labelCls}>עמדת הקבלן</label>
          <textarea
            value={contractorPosition}
            onChange={e => setContractorPosition(e.target.value)}
            rows={2} className={inputCls + ' resize-none'}
            placeholder="מה ענה הקבלן על ליקוי זה..."
          />
        </div>

        {/* Tenant position */}
        <div>
          <label className={labelCls}>עמדתי / הערות</label>
          <textarea
            value={tenantPosition}
            onChange={e => setTenantPosition(e.target.value)}
            rows={2} className={inputCls + ' resize-none'}
            placeholder="הערות אישיות, מעקב, פרטים נוספים..."
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit" disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'שומר...' : 'שמור ליקוי'}
          </button>
          <Link
            href="/defects"
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            ביטול
          </Link>
        </div>
      </form>
    </div>
  )
}
