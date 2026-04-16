'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getUserProject } from '@/lib/firebase/firestore'
import { useAuth } from './AuthContext'
import type { Project } from '@/types'

interface ProjectContextType {
  project:        Project | null
  loadingProject: boolean
  refreshProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [project,        setProject]        = useState<Project | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)

  const loadProject = async () => {
    if (!user) { setProject(null); setLoadingProject(false); return }
    setLoadingProject(true)
    try {
      const p = await getUserProject(user.uid)
      setProject(p)
    } finally {
      setLoadingProject(false)
    }
  }

  useEffect(() => { loadProject() }, [user])

  return (
    <ProjectContext.Provider value={{ project, loadingProject, refreshProject: loadProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
