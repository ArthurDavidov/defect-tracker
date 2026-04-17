/**
 * Client-side PDF text extractor.
 * Must only be imported in browser components — pdfjs-dist requires DOMMatrix
 * and other browser APIs unavailable in Node.js.
 *
 * Supports two PDF formats:
 *  • seller_reply  – traditional RTL table (fixed columns, reversed Hebrew)
 *  • inspection    – "card" format: each defect is a structured card with
 *                    "N.M ממצא" label, description text, and "מיקום" / "מחיר" rows
 */
import type { ParsedItem, ContractorPositionClass, DocumentType } from '@/types'

// ─── RTL correction (seller reply only) ──────────────────────────────────────

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

// ─── Seller-reply helpers ─────────────────────────────────────────────────────

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

// ─── Inspection-report card parser ───────────────────────────────────────────
//
// Each defect card looks like (Y decreases downward in PDF coords):
//
//   Y=728  [x519 "1.2 ממצא"]   [x215 "description text..."]
//   Y=712  [x505 "ממצא בדיקה"]
//   Y=704  [x438 "תוקן חלקית"]     ← status (excluded)
//   Y=672  [x539 "מיקום"]       [x413 "חדר רחצה הורים"]
//   Y=656  [x533 "המלצה"]       [x293 "recommendation text"]
//   Y=632  [x543 "מחיר"]        [x296 "₪350 (...)"]
//
// Right-side labels (x > 460) separate the card into zones.

type RawItem = { str: string; x: number; y: number }

// Matches "1.1 ממצא", "3.2 ממצא" etc.
const MMTZA_RE = /^(\d+\.\d+)\s*ממצא/

// Status / label strings that should NOT end up in the description
const SKIP_STR = /^(ממצא בדיקה|בדיקה חוזרת|לא תוקן|תוקן|תוקן חלקית|לא בוצע|חוזרת|מיקום|המלצה|תקן|מחיר)$/

function parseCardsFromPage(items: RawItem[]): ParsedItem[] {
  const results: ParsedItem[] = []

  // Find every "N.M ממצא" label on this page
  const markers = items
    .filter(i => MMTZA_RE.test(i.str.trim()))
    .map(i => ({ ...i, section: i.str.trim().match(MMTZA_RE)![1] }))

  if (markers.length === 0) return []

  for (const mark of markers) {
    const { y: yMark, section } = mark

    // Helper: find the nearest occurrence of a label BELOW the ממצא mark
    // (lower Y in PDF coords = lower on the page = below in reading order)
    const labelBelow = (label: string): RawItem | undefined =>
      items
        .filter(i => i.str.trim() === label && i.y < yMark && i.y > yMark - 300)
        .sort((a, b) => b.y - a.y)[0]   // closest = highest Y below yMark

    const locationLabel = labelBelow('מיקום')
    const recLabel      = labelBelow('המלצה')
    const priceLabel    = labelBelow('מחיר')

    // ── Location ──────────────────────────────────────────────────────────
    let location = ''
    if (locationLabel) {
      // Value sits at the same Y as the label but to its left (lower x)
      const val = items
        .filter(i =>
          Math.abs(i.y - locationLabel.y) <= 8 &&
          i.x < locationLabel.x - 5 &&
          i.str.trim() !== 'מיקום'
        )
        .sort((a, b) => b.x - a.x)[0]   // rightmost = closest to the label
      location = val?.str.trim() ?? ''
    }

    // ── Cost ──────────────────────────────────────────────────────────────
    let estimatedCost: number | undefined
    if (priceLabel) {
      const val = items
        .filter(i =>
          Math.abs(i.y - priceLabel.y) <= 8 &&
          i.x < priceLabel.x &&
          i.str.includes('₪')
        )
        .sort((a, b) => b.x - a.x)[0]
      if (val) {
        const m = val.str.match(/₪\s*([\d,]+)/)
        if (m) estimatedCost = parseInt(m[1].replace(/,/g, ''), 10)
      }
    }

    // ── Description ───────────────────────────────────────────────────────
    // Bottom boundary: the first label below ממצא (מיקום → המלצה → מחיר)
    const bottomY = (locationLabel ?? recLabel ?? priceLabel)?.y ?? (yMark - 150)

    const descItems = items
      .filter(i =>
        i.x < 460 &&               // left/centre content area (labels are at x ≥ 505)
        i.y > bottomY + 4 &&       // above the first label row
        i.y <= yMark + 55 &&       // no higher than ~55 pt above the ממצא mark
        i.y < 760 &&               // exclude page running header (Y ≥ 760)
        i.y > 30 &&                // exclude page footer (Y ≤ 30)
        !MMTZA_RE.test(i.str) &&   // not another ממצא marker
        !SKIP_STR.test(i.str.trim()) &&
        !(/^\d+\.\s/.test(i.str))  // not a category header "N. Name"
      )
      .sort((a, b) => b.y - a.y)  // top-to-bottom reading order

    const description = descItems.map(i => i.str.trim()).filter(Boolean).join(' ')
    if (!description) continue

    results.push({
      id:                 Math.random().toString(36).slice(2),
      section,
      location,
      description,
      contractorPosition: '',
      contractorStatus:   'pending',
      confidence:         location ? 0.9 : 0.75,
      approved:           true,
      ...(estimatedCost !== undefined ? { estimatedCost } : {}),
    })
  }

  return results
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

    if (!isSellerPdf) {
      // ── Inspection / engineer report ────────────────────────────────────
      // These use a card layout per defect, not a traditional table.
      // Each card has a "N.M ממצא" marker, a description block, and label rows
      // for מיקום (location) and מחיר (cost).
      const rawItems = (content.items as { str: string; transform: number[] }[])
        .filter(i => i.str.trim())
        .map(i => ({
          str: i.str,
          x:   Math.round(i.transform[4]),
          y:   Math.round(i.transform[5]),
        }))

      results.push(...parseCardsFromPage(rawItems))
      continue
    }

    // ── Seller reply (traditional RTL table) ─────────────────────────────
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
      const cells      = byY.get(y)!.sort((a, b) => b.x - a.x)
      const validCells = cells.filter(c => c.str.trim())
      const parts      = validCells.map(c => c.str.trim())
      if (!parts.join('').trim()) continue

      // Find section number — seller PDFs store it character-reversed
      const sectionIdx = parts.findIndex(s => {
        const normal   = /^\d+\.\d+$/.test(s)
        const reversed = /^\d+\.\d+$/.test(s.split('').reverse().join(''))
        return normal || reversed
      })
      if (sectionIdx === -1) continue

      const rawSection = parts[sectionIdx]
      const section    = rawSection.split('').reverse().join('')

      const rest         = parts.filter((_, i) => i !== sectionIdx)
      const textParts    = rest.filter(s => !isCostOrQuantity(s))
      const numericParts = rest.filter(s => isCostOrQuantity(s))

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
    }
  }

  return results
}
