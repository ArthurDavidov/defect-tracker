/**
 * Client-side PDF text extractor.
 * Must only be imported in browser components — pdfjs-dist requires DOMMatrix
 * and other browser APIs unavailable in Node.js.
 */
import type { ParsedItem, ContractorPositionClass, DocumentType } from '@/types'

// ─── RTL correction ───────────────────────────────────────────────────────────

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
  return /^\d+(\.\d+)?$/.test(clean) || s.includes('₪')
}

function extractCost(parts: string[]): number | undefined {
  const costStr = parts.find(p => p.includes('₪') || /^\d{3,}([,.\d]*)$/.test(p.replace(/[₪,\s]/g, '')))
  if (!costStr) return undefined
  const num = parseFloat(costStr.replace(/[₪,\s]/g, ''))
  return isNaN(num) ? undefined : num
}

// ─── Inspection-report column detection ──────────────────────────────────────

interface ColMap { location?: number; description?: number; cost?: number }

/**
 * Scan all rows looking for the table's header row (the one that contains
 * Hebrew column labels like "מיקום" and "ליקוי").  Returns the X coordinate
 * of each recognised column so data rows can be assigned correctly.
 */
function detectColumns(
  byY: Map<number, { str: string; x: number }[]>,
  sortedYs: number[]
): ColMap {
  const PATTERNS: [keyof ColMap, RegExp][] = [
    ['location',    /^מיקום/],
    ['description', /^(ליקוי|תיאור|פגם|ממצא)/],
    ['cost',        /^(עלות|מחיר|סה"כ)/],
  ]

  for (const y of sortedYs) {
    const cells = byY.get(y)!
    const found: ColMap = {}
    let hits = 0
    for (const cell of cells) {
      const s = cell.str.trim()
      for (const [col, re] of PATTERNS) {
        if (re.test(s)) { found[col] = cell.x; hits++; break }
      }
    }
    if (hits >= 2) return found
  }
  return {}
}

/** Return the column whose header X is closest to the given x value. */
function nearestColumn(x: number, cols: ColMap): keyof ColMap | null {
  let best: keyof ColMap | null = null
  let bestDist = Infinity
  for (const [col, cx] of Object.entries(cols) as [keyof ColMap, number][]) {
    const d = Math.abs(x - cx)
    if (d < bestDist) { bestDist = d; best = col }
  }
  return best
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

  const isSellerPdf = docType === 'seller_reply'
  const processText = (raw: string) => isSellerPdf ? fixRtl(raw) : raw.trim()

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()

    // Group text items by Y coordinate (±10 pt tolerance)
    const byY = new Map<number, { str: string; x: number }[]>()
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str.trim()) continue
      const y = Math.round(item.transform[5] / 10) * 10
      const x = item.transform[4]
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ str: item.str, x })
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a)

    // Detect column layout once per page (inspection reports only)
    const colMap    = isSellerPdf ? {} as ColMap : detectColumns(byY, sortedYs)
    const hasColMap = !isSellerPdf && Object.keys(colMap).length >= 2

    for (const y of sortedYs) {
      const cells      = byY.get(y)!.sort((a, b) => b.x - a.x)
      const validCells = cells.filter(c => c.str.trim())
      const parts      = validCells.map(c => c.str.trim())
      if (!parts.join('').trim()) continue

      // Find section number (e.g. "1.1", "10.2")
      const sectionIdx = parts.findIndex(s => {
        const normal   = /^\d+\.\d+$/.test(s)
        const reversed = /^\d+\.\d+$/.test(s.split('').reverse().join(''))
        return normal || reversed
      })
      if (sectionIdx === -1) continue

      const rawSection = parts[sectionIdx]
      const section    = isSellerPdf
        ? rawSection.split('').reverse().join('')
        : rawSection

      // Cells that are not the section-number cell
      const restCells  = validCells.filter((_, i) => i !== sectionIdx)
      const rest       = restCells.map(c => c.str.trim())
      const numericParts = rest.filter(s => isCostOrQuantity(s))

      if (isSellerPdf) {
        // Seller reply: columns are [location, description, contractor-position, …]
        const textParts     = rest.filter(s => !isCostOrQuantity(s))
        const location      = processText(textParts[0] ?? '')
        const description   = processText(textParts[1] ?? '')
        const contractorPos = processText(textParts[2] ?? '')

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
        // ── Inspection report ───────────────────────────────────────────────
        let location    = ''
        let description = ''

        if (hasColMap) {
          // Assign each non-section cell to the nearest detected column
          for (const cell of restCells) {
            const s = cell.str.trim()
            if (!s || isCostOrQuantity(s)) continue
            const col = nearestColumn(cell.x, colMap)
            if (col === 'location')    location    = location    ? location    + ' ' + s : s
            if (col === 'description') description = description ? description + ' ' + s : s
          }
        } else {
          // Fallback when no header row found: longest chunk = description,
          // the next chunk that looks like a room name = location
          const textParts = rest.filter(s => !isCostOrQuantity(s))
          const sorted    = [...textParts].sort((a, b) => b.length - a.length)
          description     = sorted[0] ?? ''
          const ROOM      = /חדר|מטבח|סלון|מרפסת|שירות|פרוזדור|יחידת|כניסה|גינה|מחסן|חניה|לובי|מסדרון|מבואה|אמבטיה|מקלחת/
          location        = sorted.find((s, i) => i > 0 && ROOM.test(s) && !s.includes(':')) ?? ''
        }

        if (!description) continue

        const estimatedCost = extractCost(numericParts)
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
