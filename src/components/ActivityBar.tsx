import React from 'react'
import {
  Files,
  Search,
  GitBranch,
  Boxes,
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
  const primaryActivities: Array<{
    id: ActivityView
    label: string
    icon: React.ReactNode
    badge?: number | string
  }> = [
    { id: 'explorer', label: 'Explorer (Ctrl+Shift+E)', icon: <Files className="w-4 h-4" /> },
    { id: 'search', label: 'Search (Ctrl+Shift+F)', icon: <Search className="w-4 h-4" /> },
    { id: 'git', label: 'Source Control (Ctrl+Shift+G)', icon: <GitBranch className="w-4 h-4" />, badge: 2 },
    { id: 'extensions', label: 'Extensions (Ctrl+Shift+X)', icon: <Boxes className="w-4 h-4" /> },
  ]

  return (
    <aside className="w-12 bg-[#0c0d11] border-r border-[#20222b] flex flex-col justify-between items-center py-2.5 select-none z-40">
      {/* Top primary actions */}
      <div className="flex flex-col items-center space-y-1 w-full">
        {primaryActivities.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              title={item.label}
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all group ${
                isActive
                  ? 'text-violet-300 bg-violet-950/40 border border-violet-800/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161820]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-violet-400 rounded-r" />
              )}
              {item.icon}
              {item.badge && (
                <span className="absolute top-1 right-1 px-1 min-w-[14px] h-3.5 rounded-full bg-violet-600 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}

        {/* AI Copilot shortcut in activity bar */}
        <div className="w-5 h-px bg-[#1f212c] my-2" />

        <button
          onClick={onToggleAiPanel}
          title="Ajson AI Agent (Ctrl+L)"
          className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
            aiPanelOpen
              ? 'text-violet-300 bg-violet-950/60 border border-violet-500/60 shadow-md shadow-violet-600/30'
              : 'text-violet-400/80 hover:text-violet-200 hover:bg-[#1a1b28]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400 animate-ping opacity-75" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-500" />
        </button>
      </div>

      {/* Bottom actions: Account & Settings */}
      <div className="flex flex-col items-center space-y-1.5 w-full">
        <button
          title="Developer Profile"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#161820] transition-colors"
        >
          <User className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#161820] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
