import { NextRequest, NextResponse } from 'next/server'
import type { ParsedItem } from '@/types'

// ─── DOCX parser ─────────────────────────────────────────────────────────────

function fixRtl(text: string): string {
  if (!text) return ''
  return text.split('\n').map(l => l.split('').reverse().join('')).reverse().join(' ').trim()
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
}

function parseDocxHtml(html: string): Array<string[]> {
  const rows: Array<string[]> = []
  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? []
  for (const tr of trMatches) {
    const cells: string[] = []
    const tdMatches = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? []
    for (const td of tdMatches) {
      cells.push(stripHtmlTags(td).replace(/\s+/g, ' ').trim())
    }
    if (cells.some(c => c.length > 0)) rows.push(cells)
  }
  return rows
}

async function parseDocx(buffer: ArrayBuffer): Promise<ParsedItem[]> {
  const mammoth = await import('mammoth')
  const nodeBuffer = Buffer.from(buffer)
  const { value: html } = await mammoth.convertToHtml({ buffer: nodeBuffer })
  const rows = parseDocxHtml(html)
  if (rows.length < 2) return []  // no table found

  // Skip header row; detect column count from first data row
  const dataRows = rows.slice(1)
  const items: ParsedItem[] = []

  for (const row of dataRows) {
    // Reverse columns (RTL table stored LTR)
    const cols = [...row].reverse()
    const rawSection = (cols[0] ?? '').trim()
    if (!rawSection) continue

    // Section looks like "1.1" or reversed "1.01"
    const section = /^\d+\.\d+$/.test(rawSection)
      ? rawSection.split('').reverse().join('')
      : rawSection

    const location           = fixRtl(cols[1] ?? '')
    const description        = fixRtl(cols[2] ?? '')
    const contractorPosition = fixRtl(cols[3] ?? '')

    if (!description && !location) continue

    items.push({
      id:                 Math.random().toString(36).slice(2),
      section,
      location,
      description,
      contractorPosition,
      contractorStatus:   classifyContractor(contractorPosition),
      confidence:         description.length > 5 ? 0.85 : 0.5,
      approved:           true,
    })
  }
  return items
}

// PDF parsing is done client-side (pdfjs-dist requires browser APIs like DOMMatrix).
// This API route only handles DOCX.

// ─── Contractor classifier ────────────────────────────────────────────────────
import type { ContractorPositionClass } from '@/types'

function classifyContractor(text: string): ContractorPositionClass {
  if (!text) return 'pending'
  if (/טופל|הותקן|בוצע|תוקן/.test(text))              return 'fixed'
  if (/נדחה|לא יבוצע/.test(text))                      return 'refused'
  if (/שנת הבדק|במהלך שנת/.test(text))                 return 'deferred'
  if (/הוזמן|בתיאום|נפתחה קריאת/.test(text))           return 'in_progress'
  if (/לפנות|באחריות הדייר|לספק/.test(text))           return 'redirected'
  return 'pending'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'לא נשלח קובץ' }, { status: 400 })

    const buffer     = await file.arrayBuffer()
    const fileName   = file.name.toLowerCase()
    let   parsedItems: ParsedItem[] = []

    if (fileName.endsWith('.docx')) {
      parsedItems = await parseDocx(buffer)
    } else {
      return NextResponse.json({ error: 'API זה מעבד DOCX בלבד. PDF מעובד ישירות בדפדפן.' }, { status: 400 })
    }

    return NextResponse.json({ items: parsedItems, total: parsedItems.length })
  } catch (err: any) {
    console.error('parse-document error:', err)
    return NextResponse.json({ error: `שגיאת עיבוד: ${err?.message ?? err}` }, { status: 500 })
  }
}
