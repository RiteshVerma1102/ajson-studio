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
      className={`${width ? '' : 'w-64'} bg-[#181818] border-r border-[#333333] flex flex-col h-full select-none text-xs shrink-0`}
    >
      {/* View Header */}
      <div className="h-9 px-3 border-b border-[#333333] flex items-center justify-between text-[#CCCCCC]">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-[#BBBBBB]">
          {activeView === 'explorer' && 'Explorer'}
          {activeView === 'search' && 'Search'}
          {activeView === 'git' && 'Source Control'}
          {activeView === 'jsontools' && 'JSON Tools & Suite'}
          {activeView === 'extensions' && 'Extensions'}
        </span>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden bg-[#181818]">
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

        {/* JSON TOOLS & SUITE VIEW */}
        {activeView === 'jsontools' && (
          <div className="p-3 space-y-4 overflow-y-auto h-full text-[#CCCCCC]">
            {/* Quick Actions */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold text-[#858585] uppercase tracking-wider">
                Create & Import
              </div>
              <button
                onClick={() => {
                  onOpenFile({
                    name: `Untitled-${Date.now().toString().slice(-4)}.json`,
                    path: `Untitled-${Date.now().toString().slice(-4)}.json`,
                    language: 'json',
                    content: '{\n  "name": "Ajson Studio",\n  "version": "1.0.0"\n}\n',
                  })
                }}
                className="w-full px-2.5 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] hover:border-[#007ACC] flex items-center justify-between text-[#CCCCCC] transition-colors"
              >
                <span>+ New JSON Document</span>
                <span className="font-mono text-[10px] text-[#858585]">⌘N</span>
              </button>
            </div>

            {/* Built-in Tool Launchers */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] font-semibold text-[#858585] uppercase tracking-wider">
                JSON Utilities
              </div>
              {[
                { name: 'Format & Pretty Print', desc: 'Auto-indent with custom spaces or tabs' },
                { name: 'Minify & Compact', desc: 'Strip whitespace for lightweight payloads' },
                { name: 'Sort Keys Recursively', desc: 'Alphabetical key sorting deep in AST' },
                { name: 'Interactive Tree Inspector', desc: 'Expandable key-value visualizer' },
                { name: 'Statistics & Metrics', desc: 'Key count, byte size, nesting depth' },
                { name: 'JSON Schema (AJV)', desc: 'Full draft-07/2020-12 schema validation' },
                { name: 'JSONPath Evaluator', desc: 'Extract nodes with query expressions' },
                { name: 'CSV to JSON Converter', desc: 'Bidirectional CSV table translation' },
                { name: 'TypeScript Interface Gen', desc: 'Generate TypeScript types from JSON' },
              ].map((tool) => (
                <div
                  key={tool.name}
                  onClick={() => {
                    // Open a sample or trigger JSON editor
                    onOpenFile({
                      name: 'Untitled.json',
                      path: 'Untitled.json',
                      language: 'json',
                      content: '{\n  "tool": "' + tool.name + '",\n  "status": "ready"\n}\n',
                    })
                  }}
                  className="p-2 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#333333] hover:border-[#007ACC] cursor-pointer transition-colors"
                >
                  <div className="text-[11.5px] font-medium text-white">{tool.name}</div>
                  <div className="text-[10.5px] text-[#9DA3AE]">{tool.desc}</div>
                </div>
              ))}
            </div>
          </div>
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
          <div className="p-3 space-y-3 bg-[#181818] h-full">
            <div className="flex items-center justify-between text-[#CCCCCC] pb-1 border-b border-[#333333]">
              <span className="text-[11px] font-medium flex items-center space-x-1">
                <span className="text-[#9DA3AE]">Branch:</span>
                <span className="text-[#007ACC] font-mono">feature/json-tools-ui*</span>
              </span>
              <span className="text-[10px] bg-[#252526] text-[#CCCCCC] border border-[#333333] px-1.5 py-0.5 rounded-sm">19 changes</span>
            </div>

            <div className="space-y-1.5">
              <textarea
                placeholder="Message (Ctrl+Enter to commit)"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={2}
                className="w-full bg-[#252526] border border-[#333333] rounded-sm p-2 text-[#CCCCCC] placeholder-[#6E7681] text-xs focus:border-[#007ACC] resize-none font-sans outline-none"
              />
              <button
                disabled={!commitMessage}
                className="w-full py-1.5 px-3 bg-[#007ACC] hover:bg-[#0098FF] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-sm flex items-center justify-center space-x-1.5 transition-colors text-xs"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Commit & Push</span>
              </button>
            </div>

            <div className="pt-2">
              <div className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider mb-1">
                Workspace Changes
              </div>
              <div className="flex items-center justify-between py-1 px-1.5 rounded-sm hover:bg-[#2A2D2E] text-[#CCCCCC] font-mono text-[11px]">
                <span className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">●</span>
                  <span className="truncate">{projectRoot?.name || 'Ajson Studio'}</span>
                </span>
                <Check className="w-3 h-3 text-[#858585]" />
              </div>
            </div>
          </div>
        )}

        {/* EXTENSIONS VIEW */}
        {activeView === 'extensions' && (
          <div className="p-3 space-y-3 bg-[#181818] h-full">
            <input
              type="text"
              placeholder="Search Extensions in Marketplace..."
              className="w-full bg-[#252526] border border-[#333333] rounded-sm px-2.5 py-1.5 text-[#CCCCCC] placeholder-[#6E7681] text-xs focus:border-[#007ACC] outline-none"
            />
            <div className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider">
              Installed & Built-in
            </div>
            <div className="space-y-1.5">
              {[
                { name: 'TypeScript & JavaScript', desc: 'Syntax and IntelliSense', ver: 'v5.6.3' },
                { name: 'Python Language Support', desc: 'Python syntax highlighting & formatting', ver: 'v3.12.0' },
                { name: 'JSON & Schema Tools', desc: 'Full JSON suite validation and formatting', ver: 'v1.0.0' },
                { name: 'Antigravity IDE Core', desc: 'AI-Native IDE Orchestrator', ver: 'v0.1.0' },
              ].map((ext) => (
                <div key={ext.name} className="p-2 rounded-sm bg-[#252526] border border-[#333333] hover:border-[#007ACC] flex items-start space-x-2">
                  <div className="p-1 rounded bg-[#181818] text-[#007ACC]">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate text-[11.5px]">{ext.name}</div>
                    <div className="text-[#9DA3AE] text-[10.5px] truncate">{ext.desc}</div>
                    <div className="text-[#858585] text-[9.5px] font-mono mt-0.5">{ext.ver}</div>
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
