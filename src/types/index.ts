// ─── Enums ────────────────────────────────────────────────────────────────────

export type DefectStatus   = 'open' | 'refused' | 'closed' | 'in_progress'
export type DefectSeverity = 'critical' | 'major' | 'minor'
export type DocumentType   = 'inspection_pre' | 'inspection_post' | 'seller_reply' | 'other'
export type ParseStatus    = 'idle' | 'processing' | 'ready' | 'error'
export type MemberRole     = 'owner' | 'editor' | 'viewer'

export type ContractorPositionClass =
  | 'fixed'
  | 'refused'
  | 'deferred'
  | 'in_progress'
  | 'redirected'
  | 'pending'

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Project {
  id:               string
  name:             string
  address:          string
  ownerId:          string
  deliveryDate:     string   // ISO date string
  warrantyEndDate:  string   // ISO date string (deliveryDate + 1 year)
  members:          ProjectMember[]
  createdAt:        string
}

export interface ProjectMember {
  userId:  string
  email:   string
  name:    string
  role:    MemberRole
}

export interface Defect {
  id:                    string   // Firestore doc id
  projectId:             string
  serialNumber:          number   // display order, auto-assigned
  section:               string   // e.g. "1.1", "10.1"
  location:              string
  description:           string
  sourceDocId?:          string   // which Document it came from
  sourceType:            DocumentType | 'self'
  severity:              DefectSeverity
  estimatedCost?:        number   // from engineer report (₪)
  contractorPosition:    string   // full text from seller
  contractorStatus:      ContractorPositionClass
  tenantPosition:        string   // owner's notes
  status:                DefectStatus
  images:                DefectImage[]
  timeline:              TimelineEvent[]
  createdAt:             string
  updatedAt:             string
}

export interface DefectImage {
  id:            string
  originalUrl:   string
  annotatedUrl?: string   // set after annotation saved
  caption?:      string
  uploadedAt:    string
}

export interface TimelineEvent {
  id:        string
  date:      string
  event:     string
  actorName: string
}

export interface Document {
  id:          string
  projectId:   string
  type:        DocumentType
  title:       string
  fileUrl:     string   // Firebase Storage download URL
  fileName:    string
  fileSize:    number
  uploadedAt:  string
  parseStatus: ParseStatus
  parseError?: string
  parsedItems: ParsedItem[]
}

export interface ParsedItem {
  id:                   string
  section:              string
  location:             string
  description:          string
  estimatedCost?:       number
  contractorPosition?:  string
  contractorStatus?:    ContractorPositionClass
  confidence:           number   // 0–1, for review screen
  approved:             boolean
  matchedDefectId?:     string   // set after matching to existing defect
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<DefectStatus, string> = {
  open:        'פתוח לטיפול',
  refused:     'סירוב לתקן',
  closed:      'בוצע / טופל',
  in_progress: 'בטיפול',
}

export const STATUS_COLORS: Record<DefectStatus, string> = {
  open:        'bg-yellow-100 text-yellow-800 border-yellow-300',
  refused:     'bg-red-100 text-red-700 border-red-300',
  closed:      'bg-green-100 text-green-800 border-green-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
}

export const SEVERITY_LABELS: Record<DefectSeverity, string> = {
  critical: 'קריטי',
  major:    'חמור',
  minor:    'קל',
}

export const SEVERITY_COLORS: Record<DefectSeverity, string> = {
  critical: 'bg-red-500 text-white',
  major:    'bg-orange-400 text-white',
  minor:    'bg-gray-200 text-gray-700',
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  inspection_pre:  'דו"ח בדק טרום מסירה',
  inspection_post: 'דו"ח בדק לאחר מסירה',
  seller_reply:    'תגובת קבלן',
  other:           'אחר',
}

export const CONTRACTOR_STATUS_LABELS: Record<ContractorPositionClass, string> = {
  fixed:       'טופל',
  refused:     'נדחה',
  deferred:    'נדחה לשנת בדק',
  in_progress: 'בטיפול',
  redirected:  'הופנה לספק',
  pending:     'ממתין',
}

export const CONTRACTOR_STATUS_COLORS: Record<ContractorPositionClass, string> = {
  fixed:       'bg-green-100 text-green-700',
  refused:     'bg-red-100 text-red-700',
  deferred:    'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  redirected:  'bg-purple-100 text-purple-700',
  pending:     'bg-gray-100 text-gray-600',
}
