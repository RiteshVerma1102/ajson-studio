import React, { useState } from 'react'
import {
  GitCommit,
  Check,
  Boxes,
} from 'lucide-react'
import { ActivityView, FileTreeNode, SupportedLanguage } from '../types/editor'
import { FileExplorer } from './FileExplorer'

import { ProjectSearch } from './ProjectSearch'

interface SidebarProps {
  activeView: ActivityView
  onOpenFile: (file: { name: string; path: string; language: SupportedLanguage; content?: string }) => void
  onOpenLocalFileDialog: () => void
  activeFilePath?: string
  projectRoot: { path: string; name: string } | null
  tree: FileTreeNode[]
  isLoadingTree?: boolean
  treeError?: string | null
  onOpenFolderDialog: () => void
  onRefreshProject: () => void
  onFileCreated?: (newPath: string) => void
  onItemRenamed?: (oldPath: string, newPath: string, newName: string) => void
  onItemDeleted?: (deletedPath: string) => void
  unsavedBuffers?: Array<{ path: string; content: string }>
  width?: number
  recentProjects?: Array<{ path: string; name: string; exists?: boolean }>
  onOpenRecentProject?: (path: string) => void
  onRemoveRecentProject?: (path: string) => void
  onOpenFileAtLocation?: (file: {
    name: string
    path: string
    lineNumber: number
    column: number
    matchLength?: number
  }) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onOpenFile,
  activeFilePath,
  projectRoot,
  tree,
  isLoadingTree = false,
  treeError = null,
  onOpenFolderDialog,
  onRefreshProject,
  onFileCreated,
  onItemRenamed,
  onItemDeleted,
  width,
  recentProjects = [],
  onOpenRecentProject,
  onRemoveRecentProject,
  unsavedBuffers = [],
  onOpenFileAtLocation,
}) => {
  const [commitMessage, setCommitMessage] = useState('')

  return (
    <div
      style={{ width: width ? `${width}px` : undefined }}
      className={`${width ? '' : 'w-64'} bg-[#121419] border-r border-[#20222b] flex flex-col h-full select-none text-xs shrink-0`}
    >
      {/* View Header */}
      <div className="h-9 px-3 border-b border-[#20222b] flex items-center justify-between text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">
          {activeView === 'explorer' && 'Explorer'}
          {activeView === 'search' && 'Search'}
          {activeView === 'git' && 'Source Control'}
          {activeView === 'extensions' && 'Extensions'}
        </span>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden">
        {/* EXPLORER VIEW */}
        {activeView === 'explorer' && (
          <FileExplorer
            projectRoot={projectRoot}
            tree={tree}
            isLoadingTree={isLoadingTree}
            treeError={treeError}
            activeFilePath={activeFilePath}
            onOpenFile={onOpenFile}
            onOpenFolderDialog={onOpenFolderDialog}
            onRefresh={onRefreshProject}
            onFileCreated={onFileCreated}
            onItemRenamed={onItemRenamed}
            onItemDeleted={onItemDeleted}
            recentProjects={recentProjects}
            onOpenRecentProject={onOpenRecentProject}
            onRemoveRecentProject={onRemoveRecentProject}
          />
        )}

        {/* SEARCH VIEW */}
        {activeView === 'search' && (
          <ProjectSearch
            projectRoot={projectRoot}
            unsavedBuffers={unsavedBuffers}
            onOpenFileAtLocation={(f) => {
              if (onOpenFileAtLocation) {
                onOpenFileAtLocation(f)
              } else {
                onOpenFile({ name: f.name, path: f.path, language: 'plaintext' })
              }
            }}
          />
        )}

        {/* SOURCE CONTROL VIEW */}
        {activeView === 'git' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-[#20222b]">
              <span className="text-[11px] font-medium flex items-center space-x-1">
                <span>Branch:</span>
                <span className="text-violet-400 font-mono">main*</span>
              </span>
              <span className="text-[10px] bg-violet-950/50 text-violet-300 border border-violet-800/40 px-1.5 py-0.5 rounded">Active</span>
            </div>

            <div className="space-y-1.5">
              <textarea
                placeholder="Commit message (e.g. feat: add AST guardrails)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={2}
                className="w-full bg-[#161822] border border-[#262838] rounded-lg p-2 text-slate-200 placeholder-slate-500 text-xs focus:border-violet-500 resize-none font-mono"
              />
              <button
                disabled={!commitMessage}
                className="w-full py-1.5 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center space-x-1.5 transition-all text-xs shadow-md shadow-violet-600/20"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Commit & Push</span>
              </button>
            </div>

            <div className="pt-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Workspace
              </div>
              <div className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#151926] text-slate-300 font-mono text-[11px]">
                <span className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">●</span>
                  <span className="truncate">{projectRoot?.name || 'Ajson Studio'}</span>
                </span>
                <Check className="w-3 h-3 text-slate-500" />
              </div>
            </div>
          </div>
        )}

        {/* EXTENSIONS VIEW */}
        {activeView === 'extensions' && (
          <div className="p-3 space-y-3">
            <input
              type="text"
              placeholder="Search Extensions..."
              className="w-full bg-[#121622] border border-[#20273b] rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-500 text-xs focus:border-cyan-500"
            />
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Installed & Built-in
            </div>
            <div className="space-y-2">
              {[
                { name: 'TypeScript & JavaScript', desc: 'Syntax and IntelliSense', ver: 'v5.6.3' },
                { name: 'Python Language Support', desc: 'Python syntax highlighting & formatting', ver: 'v3.12.0' },
                { name: 'JSON & Schema Tools', desc: 'Validation and formatting', ver: 'v1.0.0' },
                { name: 'Ajson Core Engine', desc: 'AI-Native IDE Orchestrator', ver: 'v0.1.0' },
              ].map((ext) => (
                <div key={ext.name} className="p-2 rounded bg-[#131622] border border-[#1d2335] flex items-start space-x-2">
                  <div className="p-1.5 rounded bg-[#1c2234] text-cyan-400">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 font-medium truncate text-[11.5px]">{ext.name}</div>
                    <div className="text-slate-400 text-[10.5px] truncate">{ext.desc}</div>
                    <div className="text-slate-500 text-[9.5px] font-mono mt-0.5">{ext.ver}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
