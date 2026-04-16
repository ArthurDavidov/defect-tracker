import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, parseISO, addYears, format } from 'date-fns'
import { he } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Warranty helpers ─────────────────────────────────────────────────────────

export function warrantyEndDate(deliveryDate: string): string {
  return addYears(parseISO(deliveryDate), 1).toISOString().split('T')[0]
}

export function daysUntilWarrantyEnd(warrantyEnd: string): number {
  return differenceInDays(parseISO(warrantyEnd), new Date())
}

export function warrantyUrgency(daysLeft: number): 'safe' | 'warning' | 'critical' | 'expired' {
  if (daysLeft < 0)   return 'expired'
  if (daysLeft < 30)  return 'critical'
  if (daysLeft < 90)  return 'warning'
  return 'safe'
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDateHe(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd בMMMM yyyy', { locale: he })
  } catch {
    return dateStr
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style:    'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}
