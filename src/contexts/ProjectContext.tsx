'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getUserProject } from '@/lib/firebase/firestore'
import { useAuth } from './AuthContext'
import type { Project } from '@/types'

interface ProjectContextType {
  project:        Project | null
  loadingProject: boolean
  projectError:   string | null
  refreshProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()

  const [project,        setProject]        = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)   // stay true until we know
  const [projectError,   setProjectError]   = useState<string | null>(null)

  const loadProject = async () => {
    if (!user) {
      setProject(null)
      setProjectError(null)
      setLoadingProject(false)
      return
    }
    setLoadingProject(true)
    setProjectError(null)
    try {
      const p = await getUserProject(user.uid)
      setProject(p)
    } catch (err: any) {
      console.error('ProjectContext: failed to load project', err)
      setProjectError(err?.message ?? 'שגיאה בטעינת הפרויקט')
    } finally {
      setLoadingProject(false)
    }
  }

  useEffect(() => {
    // Wait for Firebase auth to fully resolve before querying Firestore.
    // Without this guard, the context sets loadingProject=false while user
    // is still null, creating a window where the app layout sees
    // (user=set, project=null, loadingProject=false) and redirects to /setup.
    if (authLoading) return
    loadProject()
  }, [authLoading, user?.uid])

  return (
    <ProjectContext.Provider value={{ project, loadingProject, projectError, refreshProject: loadProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
