'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { subscribeToDefects } from '@/lib/firebase/firestore'
import { daysUntilWarrantyEnd, warrantyUrgency, formatDateHe, formatCurrency } from '@/lib/utils'
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, FileText, Plus, FileOutput } from 'lucide-react'
import type { Defect } from '@/types'
import { STATUS_LABELS, SEVERITY_LABELS } from '@/types'

export default function DashboardPage() {
  const { project } = useProject()
  const [defects, setDefects] = useState<Defect[]>([])

  useEffect(() => {
    if (!project) return
    return subscribeToDefects(project.id, setDefects)
  }, [project?.id])

  if (!project) return null

  const daysLeft = daysUntilWarrantyEnd(project.warrantyEndDate)
  const urgency  = warrantyUrgency(daysLeft)

  const stats = {
    total:       defects.length,
    open:        defects.filter(d => d.status === 'open').length,
    refused:     defects.filter(d => d.status === 'refused').length,
    in_progress: defects.filter(d => d.status === 'in_progress').length,
    closed:      defects.filter(d => d.status === 'closed').length,
    critical:    defects.filter(d => d.severity === 'critical').length,
    totalCost:   defects.reduce((s, d) => s + (d.estimatedCost ?? 0), 0),
    openCost:    defects.filter(d => d.status !== 'closed').reduce((s, d) => s + (d.estimatedCost ?? 0), 0),
  }

  const warrantyBg: Record<string, string> = {
    safe:     'from-green-500 to-emerald-600',
    warning:  'from-yellow-500 to-orange-500',
    critical: 'from-red-500 to-red-700',
    expired:  'from-gray-500 to-gray-700',
  }

  const recentDefects = [...defects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{project.address}</p>
        </div>
        <Link href="/defects/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> הוסף ליקוי
        </Link>
      </div>

      {/* Warranty countdown — hero card */}
      <div className={`bg-gradient-to-l ${warrantyBg[urgency]} rounded-2xl p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm mb-1">שנת בדק</p>
            {daysLeft > 0
              ? <>
                  <p className="text-5xl font-bold">{daysLeft}</p>
                  <p className="text-white/90 mt-1">ימים נותרו מתוך 365</p>
                </>
              : <p className="text-3xl font-bold">פגה תוקף</p>
            }
          </div>
          <div className="text-right text-sm text-white/80 space-y-1">
            <p>תאריך מסירה: <span className="text-white font-medium">{formatDateHe(project.deliveryDate)}</span></p>
            <p>מסתיים: <span className="text-white font-medium">{formatDateHe(project.warrantyEndDate)}</span></p>
            {daysLeft > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-white/30 rounded-full overflow-hidden w-48">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${Math.max(0, (365 - daysLeft) / 365 * 100)}%` }}
                  />
                </div>
                <p className="text-xs mt-1">{Math.round((365 - daysLeft) / 365 * 100)}% מהשנה חלפה</p>
              </div>
            )}
          </div>
        </div>
        {urgency === 'critical' && (
          <div className="mt-4 bg-white/20 rounded-lg px-4 py-2 text-sm font-medium">
            ⚠️ פחות מ-30 יום! הגש דוח משפטי בהקדם
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'סה"כ ליקויים', value: stats.total,       icon: AlertTriangle, color: 'text-gray-700', bg: 'bg-gray-100' },
          { label: 'פתוחים',       value: stats.open,        icon: Clock,         color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'סירובים',      value: stats.refused,     icon: XCircle,       color: 'text-red-700',    bg: 'bg-red-50'    },
          { label: 'טופלו',        value: stats.closed,      icon: CheckCircle,   color: 'text-green-700',  bg: 'bg-green-50'  },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <div className={`flex items-center gap-2 ${color} mb-2`}>
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Cost summary */}
      {stats.totalCost > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-4">
            <TrendingUp className="w-4 h-4" />
            <h2 className="font-semibold text-sm">סיכום עלויות</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">סה"כ עלות מוערכת</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">ליקויים פתוחים / בסירוב</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(stats.openCost)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent defects */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">ליקויים אחרונים</h2>
          <Link href="/defects" className="text-xs text-blue-600 hover:underline">כל הליקויים ←</Link>
        </div>
        {recentDefects.length === 0
          ? (
            <div className="p-8 text-center text-gray-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">אין ליקויים עדיין</p>
              <Link href="/defects/new" className="text-blue-600 text-xs hover:underline mt-1 block">
                הוסף ליקוי ראשון
              </Link>
            </div>
          )
          : (
            <div className="divide-y divide-gray-50">
              {recentDefects.map(d => (
                <Link key={d.id} href={`/defects/${d.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-gray-400 font-mono w-10 shrink-0">#{d.serialNumber}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.description}</p>
                    <p className="text-xs text-gray-400">{d.location} · סעיף {d.section}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border
                    ${d.status === 'open' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    : d.status === 'refused' ? 'bg-red-50 text-red-700 border-red-200'
                    : d.status === 'closed' ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {STATUS_LABELS[d.status]}
                  </span>
                </Link>
              ))}
            </div>
          )
        }
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/documents/upload"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
        >
          <FileText className="w-6 h-6 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-gray-900 text-sm">העלה מסמך</p>
          <p className="text-xs text-gray-400 mt-0.5">PDF בדק בית או תגובת קבלן</p>
        </Link>
        <Link href="/report"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:bg-purple-50 transition-colors group"
        >
          <FileOutput className="w-6 h-6 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-gray-900 text-sm">הפק דוח</p>
          <p className="text-xs text-gray-400 mt-0.5">דוח משפטי להגשה</p>
        </Link>
      </div>
    </div>
  )
}
