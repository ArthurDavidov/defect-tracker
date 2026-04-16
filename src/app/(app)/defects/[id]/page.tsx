'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { getProject, updateDefect, deleteDefect } from '@/lib/firebase/firestore'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatDateHe, formatCurrency } from '@/lib/utils'
import {
  ChevronRight, Pencil, Trash2, Save, X, Clock,
} from 'lucide-react'
import type { Defect, DefectStatus, DefectSeverity } from '@/types'
import {
  STATUS_LABELS, STATUS_COLORS,
  SEVERITY_LABELS, SEVERITY_COLORS,
  CONTRACTOR_STATUS_LABELS, CONTRACTOR_STATUS_COLORS,
} from '@/types'
import { classifyContractorResponse } from '@/lib/parsers/sellerPdf'

function firestoreErrorMessage(err: any): string {
  const code: string = err?.code ?? ''
  if (code === 'permission-denied') return 'שגיאת הרשאות – בדוק את חוקי Firestore'
  if (code === 'unavailable')       return 'שרת Firebase אינו זמין – בדוק חיבור לאינטרנט'
  if (code === 'invalid-argument')  return `נתון שגוי: ${err?.message ?? ''}`
  if (code === 'not-found')         return 'הליקוי לא נמצא'
  if (err?.message)                 return err.message
  return 'שגיאה לא ידועה – נסה שוב'
}

function newUuid(): string {
  try { return crypto.randomUUID() } catch { /* fallback */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function DefectDetailPage() {
  const { id }      = useParams<{ id: string }>()
  const { project } = useProject()
  const { user }    = useAuth()
  const router      = useRouter()

  const [defect,  setDefect]  = useState<Defect | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Edit form state
  const [description,        setDescription]        = useState('')
  const [location,           setLocation]           = useState('')
  const [section,            setSection]            = useState('')
  const [severity,           setSeverity]           = useState<DefectSeverity>('major')
  const [status,             setStatus]             = useState<DefectStatus>('open')
  const [estimatedCost,      setEstimatedCost]      = useState('')
  const [contractorPosition, setContractorPosition] = useState('')
  const [tenantPosition,     setTenantPosition]     = useState('')

  useEffect(() => {
    if (!project) return
    const load = async () => {
      const snap = await getDoc(doc(db, 'projects', project.id, 'defects', id))
      if (!snap.exists()) { router.push('/defects'); return }
      const d = { id: snap.id, ...snap.data() } as Defect
      setDefect(d)
      populateForm(d)
      setLoading(false)
    }
    load()
  }, [project?.id, id])

  function populateForm(d: Defect) {
    setDescription(d.description)
    setLocation(d.location)
    setSection(d.section)
    setSeverity(d.severity)
    setStatus(d.status)
    setEstimatedCost(d.estimatedCost ? String(d.estimatedCost) : '')
    setContractorPosition(d.contractorPosition)
    setTenantPosition(d.tenantPosition)
  }

  const handleSave = async () => {
    if (!project || !defect) return
    setSaving(true); setError('')
    try {
      const newContractorStatus = classifyContractorResponse(contractorPosition)
      const now = new Date().toISOString()
      const changes: Partial<Defect> = {
        description:        description.trim(),
        location:           location.trim(),
        section:            section.trim(),
        severity,
        status,
        // Omit estimatedCost entirely when empty — Firestore rejects undefined
        ...(estimatedCost ? { estimatedCost: Number(estimatedCost) } : {}),
        contractorPosition: contractorPosition.trim(),
        contractorStatus:   newContractorStatus,
        tenantPosition:     tenantPosition.trim(),
      }

      // Add timeline entry if status changed
      const timelineUpdate = status !== defect.status
        ? [...defect.timeline, {
            id:        newUuid(),
            date:      now,
            event:     `סטטוס שונה: ${STATUS_LABELS[defect.status]} ← ${STATUS_LABELS[status]}`,
            actorName: user?.displayName || user?.email || '',
          }]
        : defect.timeline

      await updateDefect(project.id, defect.id, { ...changes, timeline: timelineUpdate })
      setDefect({ ...defect, ...changes, timeline: timelineUpdate, updatedAt: now })
      setEditing(false)
    } catch (err: any) {
      setError(firestoreErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!project || !defect) return
    try {
      await deleteDefect(project.id, defect.id)
      router.push('/defects')
    } catch (err: any) {
      setError(firestoreErrorMessage(err))
    }
  }

  const handleStatusChange = async (newStatus: DefectStatus) => {
    if (!project || !defect || newStatus === defect.status) return
    const now = new Date().toISOString()
    const timeline = [...defect.timeline, {
      id:        newUuid(),
      date:      now,
      event:     `סטטוס שונה ל: ${STATUS_LABELS[newStatus]}`,
      actorName: user?.displayName || user?.email || '',
    }]
    await updateDefect(project.id, defect.id, { status: newStatus, timeline })
    setDefect({ ...defect, status: newStatus, timeline, updatedAt: now })
    setStatus(newStatus)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!defect) return null

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <Link href="/defects" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronRight className="w-4 h-4" /> חזרה לליקויים
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-gray-400 font-mono text-sm mt-1">#{defect.serialNumber}</span>
          <div>
            {editing ? (
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                rows={2} className={inputCls + ' resize-none text-base font-semibold'}
              />
            ) : (
              <h1 className="text-xl font-bold text-gray-900">{defect.description}</h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); populateForm(defect) }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 font-medium">
                <Pencil className="w-3.5 h-3.5" /> ערוך
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">למחוק?</span>
                  <button onClick={handleDelete}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 font-medium">
                    כן, מחק
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">
                    ביטול
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick status buttons */}
      {!editing && (
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(STATUS_LABELS) as DefectStatus[]).map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                defect.status === s
                  ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-blue-400'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="font-medium">שגיאה</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      )}

      {/* Details grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 md:grid-cols-3 gap-5">
        <div>
          <p className={labelCls}>מיקום</p>
          {editing
            ? <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputCls} />
            : <p className="text-sm font-medium text-gray-900">{defect.location}</p>
          }
        </div>
        <div>
          <p className={labelCls}>סעיף</p>
          {editing
            ? <input type="text" value={section} onChange={e => setSection(e.target.value)} className={inputCls} dir="ltr" />
            : <p className="text-sm font-medium text-gray-900">{defect.section || '–'}</p>
          }
        </div>
        <div>
          <p className={labelCls}>חומרה</p>
          {editing
            ? <select value={severity} onChange={e => setSeverity(e.target.value as DefectSeverity)} className={inputCls}>
                <option value="critical">קריטי</option>
                <option value="major">חמור</option>
                <option value="minor">קל</option>
              </select>
            : <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${SEVERITY_COLORS[defect.severity]}`}>
                {SEVERITY_LABELS[defect.severity]}
              </span>
          }
        </div>
        <div>
          <p className={labelCls}>עלות מוערכת</p>
          {editing
            ? <input type="number" min="0" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} className={inputCls} dir="ltr" />
            : <p className="text-sm font-medium text-gray-900">
                {defect.estimatedCost ? formatCurrency(defect.estimatedCost) : '–'}
              </p>
          }
        </div>
        <div>
          <p className={labelCls}>עמדת הקבלן (סיווג)</p>
          <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${CONTRACTOR_STATUS_COLORS[defect.contractorStatus]}`}>
            {CONTRACTOR_STATUS_LABELS[defect.contractorStatus]}
          </span>
        </div>
        <div>
          <p className={labelCls}>עודכן</p>
          <p className="text-sm text-gray-700">{formatDateHe(defect.updatedAt)}</p>
        </div>
      </div>

      {/* Contractor position */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className={labelCls}>עמדת הקבלן (טקסט מלא)</p>
        {editing
          ? <textarea value={contractorPosition} onChange={e => setContractorPosition(e.target.value)}
              rows={3} className={inputCls + ' resize-none mt-1'} />
          : <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {defect.contractorPosition || <span className="text-gray-400 italic">לא צוין</span>}
            </p>
        }
      </div>

      {/* Tenant position */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className={labelCls}>עמדתי / הערות</p>
        {editing
          ? <textarea value={tenantPosition} onChange={e => setTenantPosition(e.target.value)}
              rows={3} className={inputCls + ' resize-none mt-1'} />
          : <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {defect.tenantPosition || <span className="text-gray-400 italic">לא צוין</span>}
            </p>
        }
      </div>

      {/* Timeline */}
      {defect.timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">היסטוריה</p>
          </div>
          <div className="space-y-3">
            {[...defect.timeline].reverse().map(ev => (
              <div key={ev.id} className="flex gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-gray-700">{ev.event}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateHe(ev.date)} · {ev.actorName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
