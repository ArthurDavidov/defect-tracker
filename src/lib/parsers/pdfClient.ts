/**
 * Client-side PDF text extractor.
 * Must only be imported in browser components — pdfjs-dist requires DOMMatrix
 * and other browser APIs that are not available in Node.js API routes.
 */
import type { ParsedItem, ContractorPositionClass } from '@/types'

function fixRtl(text: string): string {
  if (!text) return ''
  return text.split('\n').map(l => l.split('').reverse().join('')).reverse().join(' ').trim()
}

function classifyContractor(text: string): ContractorPositionClass {
  if (!text) return 'pending'
  if (/טופל|הותקן|בוצע|תוקן/.test(text))    return 'fixed'
  if (/נדחה|לא יבוצע/.test(text))            return 'refused'
  if (/שנת הבדק|במהלך שנת/.test(text))       return 'deferred'
  if (/הוזמן|בתיאום|נפתחה קריאת/.test(text)) return 'in_progress'
  if (/לפנות|באחריות הדייר|לספק/.test(text)) return 'redirected'
  return 'pending'
}

export async function parsePdfInBrowser(file: File): Promise<ParsedItem[]> {
  const pdfjsLib = await import('pdfjs-dist')

  // Use CDN worker so we don't need to bundle it
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const buffer  = await file.arrayBuffer()
  const pdf     = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const results: ParsedItem[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Group text items by Y coordinate (±6 pt tolerance)
    const byY = new Map<number, { str: string; x: number }[]>()
    for (const raw of content.items as { str: string; transform: number[] }[]) {
      const y = Math.round(raw.transform[5] / 6) * 6
      const x = raw.transform[4]
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ str: raw.str, x })
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a)  // top → bottom

    for (const y of sortedYs) {
      const cells = byY.get(y)!.sort((a, b) => b.x - a.x)  // RTL: right → left
      const parts = cells.map(c => c.str.trim()).filter(Boolean)
      if (parts.length < 2) continue

      // Detect section number (may be reversed: "1.01" → section "10.1")
      const sectionIdx = parts.findIndex(s =>
        /^\d+\.\d+$/.test(s) ||
        /^\d+\.\d+$/.test(s.split('').reverse().join(''))
      )
      if (sectionIdx === -1) continue

      const rawSection = parts[sectionIdx]
      const section = /^\d+\.\d+$/.test(rawSection)
        ? rawSection
        : rawSection.split('').reverse().join('')

      const rest               = parts.filter((_, i) => i !== sectionIdx)
      const description        = fixRtl(rest[0] ?? '')
      const location           = fixRtl(rest[1] ?? '')
      const contractorPosition = fixRtl(rest[2] ?? '')

      if (!description) continue

      results.push({
        id:                 Math.random().toString(36).slice(2),
        section,
        location,
        description,
        contractorPosition,
        contractorStatus:   classifyContractor(contractorPosition),
        confidence:         0.7,
        approved:           true,
      })
    }
  }

  return results
}
