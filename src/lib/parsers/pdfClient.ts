/**
 * Client-side PDF text extractor.
 * Must only be imported in browser components — pdfjs-dist requires DOMMatrix
 * and other browser APIs unavailable in Node.js.
 */
import type { ParsedItem, ContractorPositionClass, DocumentType } from '@/types'

// ─── RTL correction ───────────────────────────────────────────────────────────
// Only needed for seller PDFs whose generator stores each character reversed.
// Inspection report PDFs are standard — pdfjs-dist already returns correct text.

function fixRtl(text: string): string {
  if (!text) return ''
  return text.split('\n').map(l => l.split('').reverse().join('')).reverse().join(' ').trim()
}

// ─── Contractor classifier ────────────────────────────────────────────────────

function classifyContractor(text: string): ContractorPositionClass {
  if (!text) return 'pending'
  if (/טופל|הותקן|בוצע|תוקן/.test(text))    return 'fixed'
  if (/נדחה|לא יבוצע/.test(text))            return 'refused'
  if (/שנת הבדק|במהלך שנת/.test(text))       return 'deferred'
  if (/הוזמן|בתיאום|נפתחה קריאת/.test(text)) return 'in_progress'
  if (/לפנות|באחריות הדייר|לספק/.test(text)) return 'redirected'
  return 'pending'
}

// ─── Column classifier ────────────────────────────────────────────────────────

function isCostOrQuantity(s: string): boolean {
  const clean = s.replace(/[₪,\s]/g, '')
  // Pure number (quantity like 1, 2, 3) or currency amount
  return /^\d+(\.\d+)?$/.test(clean) || s.includes('₪')
}

function extractCost(parts: string[]): number | undefined {
  const costStr = parts.find(p => p.includes('₪') || /^\d{3,}([,.\d]*)$/.test(p.replace(/[₪,\s]/g, '')))
  if (!costStr) return undefined
  const num = parseFloat(costStr.replace(/[₪,\s]/g, ''))
  return isNaN(num) ? undefined : num
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parsePdfInBrowser(
  file: File,
  docType: DocumentType
): Promise<ParsedItem[]> {
  const pdfjsLib = await import('pdfjs-dist')

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const buffer  = await file.arrayBuffer()
  const pdf     = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const results: ParsedItem[] = []

  // Seller reply PDFs have character-reversed Hebrew text; inspection reports do not.
  const isSellerPdf = docType === 'seller_reply'

  const processText = (raw: string) => isSellerPdf ? fixRtl(raw) : raw.trim()

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Group text items by Y coordinate (±10 pt tolerance).
    // Wider tolerance than the default catches location cells that sit a few
    // pts above/below the description text due to vertical cell alignment.
    const byY = new Map<number, { str: string; x: number }[]>()
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str.trim()) continue
      const y = Math.round(item.transform[5] / 10) * 10
      const x = item.transform[4]
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ str: item.str, x })
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a)

    for (const y of sortedYs) {
      const cells  = byY.get(y)!.sort((a, b) => b.x - a.x)
      const parts  = cells.map(c => c.str.trim()).filter(Boolean)
      const joined = parts.join(' ')
      if (!joined.trim()) continue

      // Find section number (e.g. "1.1", "10.2")
      // For seller PDFs the section is stored reversed: "1.01" → section "10.1"
      const sectionIdx = parts.findIndex(s => {
        const normal   = /^\d+\.\d+$/.test(s)
        const reversed = /^\d+\.\d+$/.test(s.split('').reverse().join(''))
        return normal || reversed
      })
      if (sectionIdx === -1) continue

      const rawSection = parts[sectionIdx]
      const section = isSellerPdf
        ? rawSection.split('').reverse().join('')
        : rawSection

      const rest = parts.filter((_, i) => i !== sectionIdx)

      // Separate descriptive text from numeric/cost columns
      const textParts   = rest.filter(s => !isCostOrQuantity(s))
      const numericParts = rest.filter(s => isCostOrQuantity(s))

      if (isSellerPdf) {
        // Seller reply: columns are [location, description, contractor-position, remarks] reversed
        const cols            = textParts
        const location        = processText(cols[0] ?? '')
        const description     = processText(cols[1] ?? '')
        const contractorPos   = processText(cols[2] ?? '')

        if (!description && !location) continue

        results.push({
          id:                 Math.random().toString(36).slice(2),
          section,
          location,
          description:        description || location,
          contractorPosition: contractorPos,
          contractorStatus:   classifyContractor(contractorPos),
          confidence:         description.length > 5 ? 0.85 : 0.5,
          approved:           true,
        })
      } else {
        // Inspection report: sort text parts by length — the longest chunk is the
        // defect description.  Location is the next-longest chunk that is NOT a
        // short abbreviation code (Hebrew abbreviated notes like "קומפ'", "יח'"
        // end with an apostrophe and are only a few chars long).
        const isCode = (s: string) => s.endsWith("'") || s.endsWith('\u05f4') || s.length <= 3
        const sorted      = [...textParts].sort((a, b) => b.length - a.length)
        const description = processText(sorted[0] ?? '')
        const locationCandidate = sorted.find((s, i) => i > 0 && !isCode(s))
        const location    = processText(locationCandidate ?? '')
        const estimatedCost = extractCost(numericParts)

        if (!description) continue

        const item: ParsedItem = {
          id:                 Math.random().toString(36).slice(2),
          section,
          location,
          description,
          contractorPosition: '',
          contractorStatus:   'pending',
          confidence:         0.75,
          approved:           true,
        }
        if (estimatedCost !== undefined) item.estimatedCost = estimatedCost
        results.push(item)
      }
    }
  }

  return results
}
