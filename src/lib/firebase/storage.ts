import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

export async function uploadFile(
  path: string,
  file: File | Blob,
  contentType?: string
): Promise<string> {
  const storageRef = ref(storage, path)
  const meta = contentType ? { contentType } : undefined
  await uploadBytes(storageRef, file, meta)
  return getDownloadURL(storageRef)
}

export async function uploadDefectImage(
  projectId: string,
  defectId: string,
  imageId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `projects/${projectId}/defects/${defectId}/images/${imageId}.${ext}`
  return uploadFile(path, file, file.type)
}

export async function uploadAnnotatedImage(
  projectId: string,
  defectId: string,
  imageId: string,
  blob: Blob
): Promise<string> {
  const path = `projects/${projectId}/defects/${defectId}/images/${imageId}_annotated.png`
  return uploadFile(path, blob, 'image/png')
}

export async function uploadDocument(
  projectId: string,
  docId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split('.').pop() || 'pdf'
  const path = `projects/${projectId}/documents/${docId}.${ext}`
  return uploadFile(path, file, file.type)
}

export async function deleteFile(url: string) {
  try {
    const fileRef = ref(storage, url)
    await deleteObject(fileRef)
  } catch {
    // ignore missing-file errors
  }
}
