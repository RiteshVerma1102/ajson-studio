import React from 'react'
import {
  Files,
  Search,
  GitBranch,
  Boxes,
  FileJson,
  Sparkles,
  Settings,
  User,
} from 'lucide-react'
import { ActivityView } from '../types/editor'

interface ActivityBarProps {
  activeView: ActivityView
  onSelectView: (view: ActivityView) => void
  aiPanelOpen: boolean
  onToggleAiPanel: () => void
  onOpenSettings?: () => void
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onSelectView,
  aiPanelOpen,
  onToggleAiPanel,
  onOpenSettings,
}) => {
  // Real count of changed files from `git status` (desktop app only)
  const [gitChangeCount, setGitChangeCount] = React.useState(0)
  React.useEffect(() => {
    const api = window.ajsonAPI?.git
    if (!api) {
      return
    }
    let alive = true
    const poll = () => {
      api
        .status()
        .then((st) => alive && setGitChangeCount(st.isRepo ? st.changes.length : 0))
        .catch(() => alive && setGitChangeCount(0))
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const primaryActivities: Array<{
    id: ActivityView
    label: string
    icon: React.ReactNode
    badge?: number | string
  }> = [
    { id: 'explorer', label: 'Explorer (Ctrl+Shift+E)', icon: <Files className="w-5 h-5" /> },
    { id: 'search', label: 'Search (Ctrl+Shift+F)', icon: <Search className="w-5 h-5" /> },
    { id: 'git', label: 'Source Control (Ctrl+Shift+G)', icon: <GitBranch className="w-5 h-5" />, badge: gitChangeCount > 0 ? gitChangeCount : undefined },
    { id: 'jsontools', label: 'JSON Tools & Suite', icon: <FileJson className="w-5 h-5" /> },
    { id: 'extensions', label: 'Extensions (Ctrl+Shift+X)', icon: <Boxes className="w-5 h-5" /> },
  ]

  return (
    <aside className="w-12 bg-[#181818] border-r border-[#333333] flex flex-col justify-between items-center py-1 select-none z-40 shrink-0">
      {/* Top primary action icons */}
      <div className="flex flex-col items-center w-full">
        {primaryActivities.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              title={item.label}
              className={`relative w-12 h-11 flex items-center justify-center transition-colors group ${
                isActive
                  ? 'text-white border-l-2 border-[#007ACC]'
                  : 'text-[#858585] hover:text-[#D4D4D4] border-l-2 border-transparent'
              }`}
            >
              {item.icon}
              {item.badge && (
                <span className="absolute top-1.5 right-1.5 px-1 min-w-[14px] h-3.5 rounded-full bg-[#007ACC] text-white text-[9px] font-mono font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}

        {/* AI Assistant shortcut */}
        <button
          onClick={onToggleAiPanel}
          title="Toggle AI Assistant (Ctrl+L)"
          className={`relative w-12 h-11 flex items-center justify-center transition-colors mt-1 ${
            aiPanelOpen
              ? 'text-[#007ACC] border-l-2 border-[#007ACC]'
              : 'text-[#858585] hover:text-[#D4D4D4] border-l-2 border-transparent'
          }`}
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom actions: User Profile & Settings */}
      <div className="flex flex-col items-center w-full pb-1">
        <button
          title="Accounts"
          className="w-12 h-10 flex items-center justify-center text-[#858585] hover:text-[#D4D4D4] transition-colors"
        >
          <User className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          className="w-12 h-10 flex items-center justify-center text-[#858585] hover:text-[#D4D4D4] transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}
