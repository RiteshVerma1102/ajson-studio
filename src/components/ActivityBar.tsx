import React from 'react'
import {
  Files,
  Search,
  GitBranch,
  Boxes,
  Sparkles,
  Settings,
} from 'lucide-react'
import { ActivityView } from '../types/editor'

interface ActivityBarProps {
  activeView: ActivityView
  onSelectView: (view: ActivityView) => void
  aiPanelOpen: boolean
  onToggleAiPanel: () => void
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onSelectView,
  aiPanelOpen,
  onToggleAiPanel,
}) => {
  const primaryActivities: Array<{ id: ActivityView; label: string; icon: React.ReactNode }> = [
    { id: 'explorer', label: 'Explorer', icon: <Files className="w-5 h-5" /> },
    { id: 'search', label: 'Search', icon: <Search className="w-5 h-5" /> },
    { id: 'git', label: 'Source Control', icon: <GitBranch className="w-5 h-5" /> },
    { id: 'extensions', label: 'Extensions', icon: <Boxes className="w-5 h-5" /> },
  ]

  return (
    <aside className="w-12 bg-[#090b10] border-r border-[#1b2030] flex flex-col justify-between items-center py-2 select-none z-40">
      {/* Top primary actions */}
      <div className="flex flex-col items-center space-y-1 w-full">
        {primaryActivities.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              title={item.label}
              className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all group ${
                isActive
                  ? 'text-cyan-400 bg-[#141824]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#121622]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-cyan-400 rounded-r" />
              )}
              {item.icon}
            </button>
          )
        })}

        {/* AI Copilot shortcut in activity bar */}
        <div className="w-6 h-px bg-[#1a2030] my-2" />

        <button
          onClick={onToggleAiPanel}
          title="Ajson AI Architect (Preview)"
          className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
            aiPanelOpen
              ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 shadow-sm shadow-indigo-500/10'
              : 'text-indigo-400/70 hover:text-indigo-300 hover:bg-[#16172e]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <button
          title="Settings"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#121622] transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}
