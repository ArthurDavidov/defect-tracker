/**
 * Parser for the seller's defect-status PDF.
 *
 * The PDF is produced by a Hebrew generator that stores text
 * character-by-character in reverse (RTL stored as LTR) and also
 * reverses the column order in tables. This module corrects both issues
 * and returns a clean, structured array.
 */
import type { ParsedItem, ContractorPositionClass } from '@/types'

// ─── Text normalisation ───────────────────────────────────────────────────────

function fixRtl(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .split('\n')
    .map(line => line.split('').reverse().join(''))
    .reverse()
    .join(' ')
    .trim()
}

function fixSection(raw: string): string {
  // Raw "2.1" → actual "1.2"  |  raw "1.01" → actual "10.1"
  return raw.split('').reverse().join('')
}

// ─── Contractor position classifier ──────────────────────────────────────────

const KEYWORDS: { pattern: RegExp; status: ContractorPositionClass }[] = [
  { pattern: /הסעיף טופל|טופל|הותקן|בוצע|תוקן/,                         status: 'fixed'       },
  { pattern: /הסעיף נדחה|נדחה|לא יבוצע תיקון|לא יבוצעו/,                status: 'refused'     },
  { pattern: /יתוקנו.*שנת הבדק|במהלך שנת הבדק|תוקן.*שנת/,               status: 'deferred'    },
  { pattern: /הוזמן חומר|יתואם.*דייר|בתיאום|נפתחה קריאת שרות/,           status: 'in_progress' },
  { pattern: /לפנות.*ספק|לפנות.*מח'|באחריות הדייר|לספק הקרמיקה/,         status: 'redirected'  },
]

export function classifyContractorResponse(text: string): ContractorPositionClass {
  for (const { pattern, status } of KEYWORDS) {
    if (pattern.test(text)) return status
  }
  return 'pending'
}

// ─── Main parser (runs in Node.js API route) ─────────────────────────────────

export interface SellerRow {
  section:            string
  location:           string
  description:        string
  contractorPosition: string
  contractorStatus:   ContractorPositionClass
  remarks:            string
}

export async function parseSellerPdf(fileBuffer: ArrayBuffer): Promise<SellerRow[]> {
  // Dynamic import – pdfjs-dist for Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = await import('pdfjs-dist')

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) })
  const pdfDoc      = await loadingTask.promise
  const rows: SellerRow[] = []

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page    = await pdfDoc.getPage(p)
    const content = await page.getTextContent()

    // Group text items into rows by Y position (±4 pt tolerance)
    const byY = new Map<number, string[]>()
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = Math.round(item.transform[5] / 4) * 4
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push(item.str)
    }

    // Sort Y descending (top of page first)
    const sortedYs = [...byY.keys()].sort((a, b) => b - a)

    for (const y of sortedYs) {
      const parts = byY.get(y)!.join('')
      if (!parts.trim()) continue

      // Detect section number pattern (reversed) like "1.1", "2.01" etc.
      const secMatch = parts.match(/^\s*(\d+\.\d+)\s*$/)
      if (secMatch) continue  // standalone section cell, handled below

      // We rely on the fact that the table columns arrive as separate text runs
      // at similar Y positions. For the seller PDF we use the Python-based
      // pdfplumber extraction (via API route) which is more reliable.
      // This file provides the CLASSIFICATION and NORMALISATION utilities only.
    }
  }

  return rows
}

// ─── Server-side table extraction (called from API route) ────────────────────
// The actual row extraction is done in the Python API route (pdfplumber).
// This function receives the raw extracted rows and normalises them.

export function normaliseSellerRows(
  rawRows: Array<(string | null)[]>
): SellerRow[] {
  const result: SellerRow[] = []

  for (const row of rawRows) {
    // Reverse column order (RTL table)
    const cols = [...row].reverse()

    const rawSection = (cols[0] ?? '').trim()
    if (!rawSection || !/^\d+\.\d+$/.test(rawSection)) continue

    const section            = fixSection(rawSection)
    const location           = fixRtl(cols[1])
    const description        = fixRtl(cols[2])
    const contractorPosition = fixRtl(cols[3])
    const remarks            = fixRtl(cols[4])
    const contractorStatus   = classifyContractorResponse(contractorPosition)

    if (!description) continue

    result.push({ section, location, description, contractorPosition, contractorStatus, remarks })
  }

  return result
}
