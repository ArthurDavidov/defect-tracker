'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { useAuth } from '@/contexts/AuthContext'
import { createDefect, createDocument, getNextSerialNumber } from '@/lib/firebase/firestore'
import { ChevronRight, Upload, FileText, Check, AlertCircle, CheckCircle2 } from 'lucide-react'
import { parsePdfInBrowser } from '@/lib/parsers/pdfClient'
import type { ParsedItem, DocumentType } from '@/types'
import { DOC_TYPE_LABELS, CONTRACTOR_STATUS_LABELS, CONTRACTOR_STATUS_COLORS } from '@/types'

type Step = 'upload' | 'review' | 'done'

function newUuid(): string {
  try { return crypto.randomUUID() } catch { /* fallback */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function UploadPage() {
  const { project } = useProject()
  const { user }    = useAuth()
  const router      = useRouter()
  const fileRef     = useRef<HTMLInputElement>(null)

  const [step,     setStep]     = useState<Step>('upload')
  const [file,     setFile]     = useState<File | null>(null)
  const [docType,  setDocType]  = useState<DocumentType>('seller_reply')
  const [items,    setItems]    = useState<ParsedItem[]>([])
  const [parsing,  setParsing]  = useState(false)
  const [importing,setImporting]= useState(false)
  const [error,    setError]    = useState('')
  const [imported, setImported] = useState(0)

  if (!project || !user) return null

  // ── Step 1: parse the file ──────────────────────────────────────────────────

  const handleParse = async () => {
    if (!file) return
    setParsing(true); setError('')
    try {
      let parsed: ParsedItem[] = []

      if (file.name.toLowerCase().endsWith('.pdf')) {
        // PDF parsed client-side — pdfjs-dist requires browser APIs (DOMMatrix etc.)
        parsed = await parsePdfInBrowser(file, docType)
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        // DOCX parsed server-side via mammoth
        const form = new FormData()
        form.append('file', file)
        const res  = await fetch('/api/parse-document', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'שגיאה בעיבוד הקובץ')
        parsed = data.items
      } else {
        throw new Error('סוג קובץ לא נתמך – השתמש ב-PDF או DOCX בלבד')
      }

      if (parsed.length === 0) throw new Error('לא נמצאו פריטים בקובץ – בדוק שהקובץ מכיל טבלה עם ליקויים')
      setItems(parsed)
      setStep('review')
    } catch (err: any) {
      setError(err.message ?? 'שגיאה לא ידועה')
    } finally {
      setParsing(false)
    }
  }

  // ── Step 2: import approved items as defects ────────────────────────────────

  const toggleItem = (id: string) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, approved: !it.approved } : it))

  const toggleAll = (approved: boolean) =>
    setItems(prev => prev.map(it => ({ ...it, approved })))

  const updateItem = (id: string, field: keyof ParsedItem, value: string) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))

  const handleImport = async () => {
    const approved = items.filter(it => it.approved)
    if (approved.length === 0) { setError('לא סומנו פריטים לייבוא'); return }
    setImporting(true); setError('')
    try {
      const now = new Date().toISOString()
      let serial = await getNextSerialNumber(project.id)

      for (const item of approved) {
        await createDefect(project.id, {
          projectId:          project.id,
          serialNumber:       serial++,
          section:            item.section,
          location:           item.location,
          description:        item.description,
          sourceType:         docType,
          severity:           'major',
          status:             'open',
          ...(item.estimatedCost ? { estimatedCost: item.estimatedCost } : {}),
          contractorPosition: item.contractorPosition ?? '',
          contractorStatus:   item.contractorStatus ?? 'pending',
          tenantPosition:     '',
          images:             [],
          timeline:           [{
            id:        newUuid(),
            date:      now,
            event:     `יובא מ: ${file!.name}`,
            actorName: user.displayName || user.email || '',
          }],
          createdAt: now,
          updatedAt: now,
        })
      }

      // Save document record in Firestore
      await createDocument(project.id, {
        projectId:   project.id,
        type:        docType,
        title:       file!.name,
        fileUrl:     '',
        fileName:    file!.name,
        fileSize:    file!.size,
        uploadedAt:  now,
        parseStatus: 'ready',
        parsedItems: items,
      })

      setImported(approved.length)
      setStep('done')
    } catch (err: any) {
      setError(err?.message ?? 'שגיאה בייבוא')
    } finally {
      setImporting(false)
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/documents" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronRight className="w-4 h-4" /> חזרה למסמכים
      </Link>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'review', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              step === s ? 'border-blue-600 text-blue-600'
              : ['review','done'].indexOf(step) > i ? 'bg-green-600 border-green-600 text-white'
              : 'border-gray-300 text-gray-300'
            }`}>
              {['review','done'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${step === s ? 'text-blue-600' : 'text-gray-400'}`}>
              {s === 'upload' ? 'העלאה' : s === 'review' ? 'סקירה' : 'סיום'}
            </span>
            {i < 2 && <div className={`w-8 h-0.5 ${['review','done'].indexOf(step) > i ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: UPLOAD ── */}
      {step === 'upload' && (
        <div className="max-w-lg mx-auto space-y-5">
          <h1 className="text-xl font-bold text-gray-900">העלאת מסמך</h1>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation()
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) { setFile(dropped); setError('') }
            }}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setError('') }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-blue-500" />
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">לחץ לבחירת קובץ</p>
                <p className="text-xs text-gray-400 mt-1">PDF או DOCX בלבד</p>
              </>
            )}
          </div>

          {/* Document type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סוג המסמך</label>
            <select value={docType} onChange={e => setDocType(e.target.value as DocumentType)} className={inputCls}>
              {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map(t => (
                <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleParse} disabled={!file || parsing}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {parsing ? 'מעבד...' : 'עבד מסמך'}
          </button>
        </div>
      )}

      {/* ── STEP 2: REVIEW ── */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">סקירת פריטים</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                נמצאו <strong>{items.length}</strong> פריטים · סמן מה לייבא כליקויים
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleAll(true)}  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">סמן הכל</button>
              <button onClick={() => toggleAll(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">בטל הכל</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">סעיף</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">מיקום</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs min-w-52">ליקוי</th>
                  {docType !== 'seller_reply' && (
                    <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">עלות מוערכת</th>
                  )}
                  {docType === 'seller_reply' && (
                    <>
                      <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">עמדת קבלן</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">סטטוס</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id} className={item.approved ? '' : 'opacity-40 bg-gray-50'}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleItem(item.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          item.approved ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                        }`}>
                        {item.approved && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.section}</td>
                    <td className="px-4 py-3">
                      <input
                        value={item.location} onChange={e => updateItem(item.id, 'location', e.target.value)}
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-gray-300 focus:rounded px-1 py-0.5 text-gray-700"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        value={item.description}
                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                        rows={2}
                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-gray-300 focus:rounded px-1 py-0.5 text-gray-700 resize-none"
                      />
                    </td>
                    {docType !== 'seller_reply' && (
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {item.estimatedCost != null ? `₪${item.estimatedCost.toLocaleString()}` : '—'}
                      </td>
                    )}
                    {docType === 'seller_reply' && (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-48">
                          <p className="line-clamp-2">{item.contractorPosition}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONTRACTOR_STATUS_COLORS[item.contractorStatus ?? 'pending']}`}>
                            {CONTRACTOR_STATUS_LABELS[item.contractorStatus ?? 'pending']}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleImport} disabled={importing}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {importing ? `מייבא...` : `ייבא ${items.filter(i=>i.approved).length} ליקויים`}
            </button>
            <button onClick={() => setStep('upload')}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium">
              חזרה
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: DONE ── */}
      {step === 'done' && (
        <div className="max-w-md mx-auto text-center py-12 space-y-5">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">הייבוא הושלם!</h1>
            <p className="text-gray-500 text-sm mt-1">{imported} ליקויים נוספו בהצלחה</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link href="/defects"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              צפה בליקויים
            </Link>
            <Link href="/documents/upload"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              העלה מסמך נוסף
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
