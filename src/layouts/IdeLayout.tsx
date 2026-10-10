import React, { useState } from 'react'

interface IdeLayoutProps {
  header: React.ReactNode
  activityBar: React.ReactNode
  sidebar: React.ReactNode
  editorTabs: React.ReactNode
  editor: React.ReactNode
  bottomPanel: React.ReactNode
  aiPanel: React.ReactNode
  statusBar: React.ReactNode
  sidebarOpen: boolean
  sidebarWidth?: number
  onSidebarWidthChange?: (w: number) => void
  bottomPanelOpen: boolean
  bottomPanelHeight?: number
  onBottomPanelHeightChange?: (h: number) => void
  aiPanelOpen: boolean
}

export const IdeLayout: React.FC<IdeLayoutProps> = ({
  header,
  activityBar,
  sidebar,
  editorTabs,
  editor,
  bottomPanel,
  aiPanel,
  statusBar,
  sidebarOpen,
  sidebarWidth = 256,
  onSidebarWidthChange,
  bottomPanelOpen,
  bottomPanelHeight = 210,
  onBottomPanelHeightChange,
  aiPanelOpen,
}) => {
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const [isDraggingBottom, setIsDraggingBottom] = useState(false)

  // Sidebar drag handler
  const handleSidebarPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDraggingSidebar(true)

    const onPointerMove = (moveEvent: PointerEvent) => {
      // ActivityBar is ~48px wide on the left
      const newWidth = Math.max(180, Math.min(600, moveEvent.clientX - 48))
      onSidebarWidthChange?.(newWidth)
    }

    const onPointerUp = () => {
      setIsDraggingSidebar(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Sidebar keyboard resize handler
  const handleSidebarKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onSidebarWidthChange?.(Math.min(600, sidebarWidth + step))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onSidebarWidthChange?.(Math.max(180, sidebarWidth - step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onSidebarWidthChange?.(256)
    }
  }

  // Bottom panel drag handler
  const handleBottomPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDraggingBottom(true)

    const onPointerMove = (moveEvent: PointerEvent) => {
      // Status bar is ~24px tall on bottom
      const newHeight = Math.max(120, Math.min(600, window.innerHeight - moveEvent.clientY - 24))
      onBottomPanelHeightChange?.(newHeight)
    }

    const onPointerUp = () => {
      setIsDraggingBottom(false)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Bottom panel keyboard resize handler
  const handleBottomKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 50 : 10
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onBottomPanelHeightChange?.(Math.min(600, bottomPanelHeight + step))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onBottomPanelHeightChange?.(Math.max(120, bottomPanelHeight - step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onBottomPanelHeightChange?.(210)
    }
  }

  return (
    <div
      className={`flex flex-col w-screen h-screen overflow-hidden bg-[#090b10] text-slate-200 ${
        isDraggingSidebar || isDraggingBottom ? 'select-none pointer-events-auto' : ''
      }`}
    >
      {/* Top Application Header */}
      {header}

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Leftmost Activity Bar */}
        {activityBar}

        {/* Primary Sidebar (Explorer, Search, Git, Extensions) */}
        {sidebarOpen && sidebar}

        {/* Resizable Divider between Sidebar and Central Area */}
        {sidebarOpen && onSidebarWidthChange && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={sidebarWidth}
            aria-valuemin={180}
            aria-valuemax={600}
            aria-label="Sidebar resize divider"
            tabIndex={0}
            onPointerDown={handleSidebarPointerDown}
            onKeyDown={handleSidebarKeyDown}
            className={`w-1 cursor-col-resize select-none shrink-0 transition-colors z-20 outline-none focus:bg-cyan-500 focus:ring-1 focus:ring-cyan-400 ${
              isDraggingSidebar ? 'bg-cyan-500' : 'bg-[#181d2a] hover:bg-cyan-500/60'
            }`}
            title="Drag to resize sidebar (Arrow Left/Right to adjust)"
          />
        )}

        {/* Central Editor & Bottom Panel Area */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden bg-[#0c0e15]">
          {/* Tabs row */}
          {editorTabs}

          {/* Monaco Editor viewport */}
          <div className="flex-1 relative overflow-hidden">
            {editor}
          </div>

          {/* Resizable Divider between Editor and Bottom Panel */}
          {bottomPanelOpen && onBottomPanelHeightChange && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-valuenow={bottomPanelHeight}
              aria-valuemin={120}
              aria-valuemax={600}
              aria-label="Bottom panel resize divider"
              tabIndex={0}
              onPointerDown={handleBottomPointerDown}
              onKeyDown={handleBottomKeyDown}
              className={`h-1 cursor-row-resize select-none shrink-0 transition-colors z-20 outline-none focus:bg-cyan-500 focus:ring-1 focus:ring-cyan-400 ${
                isDraggingBottom ? 'bg-cyan-500' : 'bg-[#181d2a] hover:bg-cyan-500/60'
              }`}
              title="Drag to resize bottom panel (Arrow Up/Down to adjust)"
            />
          )}

          {/* Bottom Dock (Terminal / Problems / Output) */}
          {bottomPanelOpen && bottomPanel}
        </div>

        {/* Right AI Assistant Panel */}
        {aiPanelOpen && aiPanel}
      </div>

      {/* Bottom Status Bar */}
      {statusBar}
    </div>
  )
}
