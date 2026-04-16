'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { subscribeToDefects } from '@/lib/firebase/firestore'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import type { Defect, DefectStatus } from '@/types'
import { STATUS_LABELS, STATUS_COLORS, SEVERITY_LABELS, SEVERITY_COLORS } from '@/types'

const FILTER_TABS: { key: DefectStatus | 'all'; label: string }[] = [
  { key: 'all',         label: 'הכל'        },
  { key: 'open',        label: 'פתוח'        },
  { key: 'in_progress', label: 'בטיפול'      },
  { key: 'refused',     label: 'סירוב'       },
  { key: 'closed',      label: 'טופל'        },
]

export default function DefectsPage() {
  const { project } = useProject()
  const [defects, setDefects]   = useState<Defect[]>([])
  const [filter,  setFilter]    = useState<DefectStatus | 'all'>('all')
  const [search,  setSearch]    = useState('')

  useEffect(() => {
    if (!project) return
    return subscribeToDefects(project.id, setDefects)
  }, [project?.id])

  if (!project) return null

  const visible = defects
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        d.description.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.section.includes(q) ||
        String(d.serialNumber).includes(q)
      )
    })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ליקויים</h1>
        <Link
          href="/defects/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> הוסף ליקוי
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חפש לפי תיאור, מיקום, סעיף..."
          className="w-full border border-gray-300 rounded-lg pr-10 pl-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {FILTER_TABS.map(({ key, label }) => {
          const count = key === 'all' ? defects.length : defects.filter(d => d.status === key).length
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label} <span className="opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {search ? 'לא נמצאו ליקויים תואמים' : 'אין ליקויים בקטגוריה זו'}
          </p>
          {!search && filter === 'all' && (
            <Link href="/defects/new" className="text-blue-600 text-xs hover:underline mt-2 block">
              הוסף ליקוי ראשון
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visible.map(d => (
            <Link
              key={d.id}
              href={`/defects/${d.id}`}
              className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Serial */}
              <span className="text-xs text-gray-400 font-mono w-10 shrink-0 mt-0.5">
                #{d.serialNumber}
              </span>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{d.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {d.location}{d.section ? ` · סעיף ${d.section}` : ''}
                </p>
              </div>

              {/* Severity dot */}
              <span className={`mt-1 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_COLORS[d.severity]}`}>
                {SEVERITY_LABELS[d.severity]}
              </span>

              {/* Status badge */}
              <span className={`mt-1 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[d.status]}`}>
                {STATUS_LABELS[d.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
