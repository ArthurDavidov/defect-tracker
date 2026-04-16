'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth }    from '@/contexts/AuthContext'
import { useProject } from '@/contexts/ProjectContext'
import {
  LayoutDashboard, AlertTriangle, FileText, FileOutput,
  Settings, LogOut, Menu, X, Clock,
} from 'lucide-react'
import { useState } from 'react'
import { daysUntilWarrantyEnd, warrantyUrgency } from '@/lib/utils'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',  label: 'לוח בקרה',  icon: LayoutDashboard },
  { href: '/defects',    label: 'ליקויים',    icon: AlertTriangle   },
  { href: '/documents',  label: 'מסמכים',     icon: FileText        },
  { href: '/report',     label: 'דוח משפטי',  icon: FileOutput      },
  { href: '/settings',   label: 'הגדרות',     icon: Settings        },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logOut } = useAuth()
  const { project, loadingProject } = useProject()
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!loadingProject && !loading && user && !project &&
        pathname !== '/settings') {
      router.push('/register')
    }
  }, [project, loadingProject, loading, user, pathname, router])

  if (loading || loadingProject) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const daysLeft = project ? daysUntilWarrantyEnd(project.warrantyEndDate) : 0
  const urgency  = warrantyUrgency(daysLeft)
  const urgencyColors = {
    safe:     'bg-green-500',
    warning:  'bg-yellow-500',
    critical: 'bg-red-500 animate-pulse',
    expired:  'bg-gray-500',
  }

  const Sidebar = ({ mobile = false }) => (
    <div className={cn(
      'flex flex-col bg-white border-l border-gray-200 h-full',
      mobile ? 'w-72' : 'w-64'
    )}>
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">מעקב ליקויים</p>
            <p className="text-xs text-gray-400 truncate max-w-[150px]">{project?.address}</p>
          </div>
        </div>
      </div>

      {/* Warranty countdown */}
      {project && (
        <div className={cn(
          'mx-4 mt-4 rounded-xl p-3 text-white text-center',
          urgencyColors[urgency]
        )}>
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">שנת בדק</span>
          </div>
          {daysLeft > 0
            ? <>
                <p className="text-2xl font-bold leading-none">{daysLeft}</p>
                <p className="text-xs opacity-90">ימים נותרו</p>
              </>
            : <p className="text-sm font-bold">פג תוקף</p>
          }
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href} href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
            {user?.displayName?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.displayName || 'משתמש'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={logOut} title="יציאה" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 h-full z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <span className="font-bold text-gray-900 text-sm">מעקב ליקויים</span>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
