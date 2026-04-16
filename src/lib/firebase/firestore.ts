import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, addDoc, Timestamp,
} from 'firebase/firestore'
import { db } from './config'
import type { Project, Defect, Document as AppDocument } from '@/types'

// ─── Collections ─────────────────────────────────────────────────────────────
export const projectsCol  = () => collection(db, 'projects')
export const defectsCol   = (projectId: string) => collection(db, 'projects', projectId, 'defects')
export const documentsCol = (projectId: string) => collection(db, 'projects', projectId, 'documents')

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function getProject(projectId: string) {
  const snap = await getDoc(doc(db, 'projects', projectId))
  return snap.exists() ? { id: snap.id, ...snap.data() } as Project : null
}

export async function getUserProject(userId: string) {
  const q = query(projectsCol(), where('ownerId', '==', userId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Project
}

export async function createProject(data: Omit<Project, 'id' | 'createdAt'>) {
  const ref = doc(projectsCol())
  await setDoc(ref, { ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function updateProject(projectId: string, data: Partial<Project>) {
  await updateDoc(doc(db, 'projects', projectId), data)
}

// ─── Defects ──────────────────────────────────────────────────────────────────
export function subscribeToDefects(
  projectId: string,
  cb: (defects: Defect[]) => void
) {
  const q = query(defectsCol(projectId), orderBy('serialNumber', 'asc'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Defect))
  })
}

export async function createDefect(projectId: string, data: Omit<Defect, 'id'>) {
  const ref = doc(defectsCol(projectId))
  await setDoc(ref, data)
  return ref.id
}

export async function updateDefect(
  projectId: string,
  defectId: string,
  data: Partial<Defect>
) {
  await updateDoc(doc(db, 'projects', projectId, 'defects', defectId), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteDefect(projectId: string, defectId: string) {
  await deleteDoc(doc(db, 'projects', projectId, 'defects', defectId))
}

export async function getNextSerialNumber(projectId: string): Promise<number> {
  const snap = await getDocs(defectsCol(projectId))
  if (snap.empty) return 1
  const max = Math.max(...snap.docs.map(d => (d.data().serialNumber as number) || 0))
  return max + 1
}

// ─── Documents ────────────────────────────────────────────────────────────────
export function subscribeToDocuments(
  projectId: string,
  cb: (docs: AppDocument[]) => void
) {
  const q = query(documentsCol(projectId), orderBy('uploadedAt', 'desc'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AppDocument)  )
  })
}

export async function createDocument(projectId: string, data: Omit<AppDocument, 'id'>) {
  const ref = doc(documentsCol(projectId))
  await setDoc(ref, data)
  return ref.id
}

export async function updateDocument(
  projectId: string,
  docId: string,
  data: Partial<AppDocument>
) {
  await updateDoc(doc(db, 'projects', projectId, 'documents', docId), data)
}
