'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProject } from '@/contexts/ProjectContext'
import { subscribeToDocuments } from '@/lib/firebase/firestore'
import { formatDateHe } from '@/lib/utils'
import { FileText, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import type { Document } from '@/types'
import { DOC_TYPE_LABELS } from '@/types'

const statusIcon = {
  idle:       <Clock className="w-4 h-4 text-gray-400" />,
  processing: <Clock className="w-4 h-4 text-blue-400 animate-spin" />,
  ready:      <CheckCircle className="w-4 h-4 text-green-500" />,
  error:      <AlertCircle className="w-4 h-4 text-red-500" />,
}

export default function DocumentsPage() {
  const { project } = useProject()
  const [documents, setDocuments] = useState<Document[]>([])

  useEffect(() => {
    if (!project) return
    return subscribeToDocuments(project.id, setDocuments)
  }, [project?.id])

  if (!project) return null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">מסמכים</h1>
        <Link
          href="/documents/upload"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Upload className="w-4 h-4" /> העלה מסמך
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">אין מסמכים עדיין</p>
          <p className="text-gray-400 text-xs mt-1">העלה דוח בדק בית או תגובת קבלן לייבוא ליקויים</p>
          <Link
            href="/documents/upload"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            העלה מסמך ראשון
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {DOC_TYPE_LABELS[doc.type]} · {formatDateHe(doc.uploadedAt)}
                  {doc.parsedItems?.length > 0 && ` · ${doc.parsedItems.length} פריטים יובאו`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {statusIcon[doc.parseStatus]}
                <span className="text-xs text-gray-500 capitalize">{
                  doc.parseStatus === 'ready' ? 'יובא' :
                  doc.parseStatus === 'processing' ? 'מעבד...' :
                  doc.parseStatus === 'error' ? doc.parseError ?? 'שגיאה' : ''
                }</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
