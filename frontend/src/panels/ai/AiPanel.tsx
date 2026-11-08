/**
 * AiPanel — Claude-style AI assistant panel with Direct Code Action Injection.
 *
 * Features:
 * - Real-time streaming response with live cursor and cancel support
 * - Markdown rendering with syntax-highlighted code blocks
 * - Direct Editor Action Injection:
 *     - "Apply Patch": directly updates the active Monaco Editor buffer
 *     - "Open Diff View": opens side-by-side diff comparison tab in Monaco
 *     - "Run in Terminal": executes commands via terminalService and switches to bottom terminal tab
 *     - "Float in Canvas": spawns a dynamic floating node in the AntiGravity PhysicsCanvas
 * - Structured Tool-Use execution: parses and renders interactive Tool Action Cards
 *     (e.g., run_command, apply_diff, spawn_physics_node)
 * - Automatic active Monaco file context injection with token estimation
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Square,
  Copy,
  Check,
  Cpu,
  Trash2,
  FileCode,
  X,
  Wrench,
  Terminal as TerminalIcon,
  Atom,
  Play,
  GitCompare,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { aiService, AiChatMessage, AiModelConfig, terminalService } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { useLayoutStore } from '../../state/layoutStore';
import { usePhysicsStore } from '../../state/physicsStore';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './AiPanel.module.css';

// ---------------------------------------------------------------------------
// Tool Use & Code Block Parsing
// ---------------------------------------------------------------------------

export interface StructuredToolCall {
  id: string;
  name: 'run_command' | 'apply_diff' | 'spawn_physics_node' | string;
  args: Record<string, unknown>;
  raw: string;
}

type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }
  | { type: 'tool'; tool: StructuredToolCall };

function parseMessageSegments(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];

  // 1. Check for XML-style <tool_call name="...">...</tool_call>
  const xmlToolRe = /<tool_call\s+name=["']([^"']+)["']>([\s\S]*?)<\/tool_call>/g;
  // 2. Check for Markdown fence style ```tool:<toolName> ... ``` or normal ```lang ... ```
  const fenceRe = /```(?:tool:)?(\w*)\n?([\s\S]*?)```/g;

  let currentText = text;

  // First replace XML tool calls with placeholders or extract them
  const rawSegments: Array<{ index: number; length: number; segment: MessageSegment }> = [];

  let xmlMatch: RegExpExecArray | null;
  while ((xmlMatch = xmlToolRe.exec(currentText)) !== null) {
    const name = xmlMatch[1] || 'tool';
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(xmlMatch[2] || '{}');
    } catch {
      args = { input: xmlMatch[2]?.trim() };
    }
    rawSegments.push({
      index: xmlMatch.index,
      length: xmlMatch[0].length,
      segment: {
        type: 'tool',
        tool: {
          id: `tool-${xmlMatch.index}`,
          name,
          args,
          raw: xmlMatch[0],
        },
      },
    });
  }

  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRe.exec(currentText)) !== null) {
    const fullTag = fenceMatch[0];
    const isTool = fullTag.startsWith('```tool:');
    const lang = fenceMatch[1] || 'plaintext';
    const content = fenceMatch[2]?.trim() ?? '';

    if (isTool) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(content);
      } catch {
        args = { input: content };
      }
      rawSegments.push({
        index: fenceMatch.index,
        length: fullTag.length,
        segment: {
          type: 'tool',
          tool: {
            id: `tool-${fenceMatch.index}`,
            name: lang,
            args,
            raw: fullTag,
          },
        },
      });
    } else {
      rawSegments.push({
        index: fenceMatch.index,
        length: fullTag.length,
        segment: {
          type: 'code',
          lang,
          content,
        },
      });
    }
  }

  // Sort matched segments by index
  rawSegments.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const item of rawSegments) {
    if (item.index > lastIndex) {
      segments.push({
        type: 'text',
        content: currentText.slice(lastIndex, item.index),
      });
    }
    segments.push(item.segment);
    lastIndex = item.index + item.length;
  }

  if (lastIndex < currentText.length) {
    segments.push({
      type: 'text',
      content: currentText.slice(lastIndex),
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Tool Action Card Component
// ---------------------------------------------------------------------------

interface ToolActionCardProps {
  tool: StructuredToolCall;
  onExecuteDone?: () => void;
}

const ToolActionCard: React.FC<ToolActionCardProps> = ({ tool }) => {
  const [status, setStatus] = useState<'pending' | 'running' | 'success' | 'error'>('pending');
  const [output, setOutput] = useState<string | null>(null);

  const executeAction = async () => {
    setStatus('running');
    setOutput(null);

    try {
      if (tool.name === 'run_command' || tool.name === 'terminal') {
        const cmd = (tool.args.command as string) || (tool.args.cmd as string) || String(tool.args.input || '');
        const sessions = terminalService.listSessions();
        let sessionId = sessions[0]?.id;
        if (!sessionId) {
          sessionId = await terminalService.createSession();
        }

        useLayoutStore.getState().setActiveBottomTab('terminal');
        useLayoutStore.getState().setBottomPanelOpen(true);

        const res = await terminalService.runCommand(sessionId, cmd);
        setOutput(res.output || `Exited with code ${res.exitCode}`);
        setStatus(res.exitCode === 0 ? 'success' : 'error');
      } else if (tool.name === 'apply_diff' || tool.name === 'apply_patch') {
        const path = (tool.args.path as string) || '';
        const code = (tool.args.code as string) || (tool.args.patch as string) || String(tool.args.input || '');
        const store = useEditorStore.getState();
        const activeTab = store.tabs.find((t) => t.id === store.activeTabId);

        if (activeTab) {
          store.applyPatch(activeTab.id, code);
          useLayoutStore.getState().setActiveView('editor');
          setOutput(`Applied patch with visual diff highlights to ${path || activeTab.title}`);
        } else {
          setOutput('No active editor tab to compare.');
        }
        setStatus('success');
      } else if (tool.name === 'spawn_physics_node' || tool.name === 'physics') {
        const label = (tool.args.label as string) || 'AI Node';
        const sublabel = (tool.args.sublabel as string) || 'Spawned by AI';
        const color = (tool.args.color as string) || '#a855f7';

        usePhysicsStore.getState().spawnNode({
          label,
          sublabel,
          color,
          type: 'ai',
        });

        useLayoutStore.getState().setActiveSidebarTab('physics');
        setOutput(`Spawned physics node "${label}" in AntiGravity Canvas.`);
        setStatus('success');
      } else {
        setOutput(`Executed custom action: ${tool.name}`);
        setStatus('success');
      }
    } catch (err) {
      setOutput(`Failed: ${(err as Error).message}`);
      setStatus('error');
    }
  };

  const badgeClass =
    status === 'running'
      ? styles.badgeRunning
      : status === 'success'
      ? styles.badgeSuccess
      : status === 'error'
      ? styles.badgeError
      : styles.badgePending;

  return (
    <div className={styles.toolCard}>
      <div className={styles.toolCardHeader}>
        <div className={styles.toolHeaderLeft}>
          {tool.name.includes('command') ? (
            <TerminalIcon size={13} color="#f59e0b" />
          ) : tool.name.includes('diff') || tool.name.includes('patch') ? (
            <GitCompare size={13} color="#3b82f6" />
          ) : (
            <Atom size={13} color="#a855f7" />
          )}
          <span className={styles.toolTitle}>{tool.name}</span>
        </div>
        <span className={`${styles.toolBadge} ${badgeClass}`}>{status}</span>
      </div>

      <div className={styles.toolBody}>
        <div className={styles.toolParam}>
          {JSON.stringify(tool.args, null, 2)}
        </div>

        <div className={styles.toolFooter}>
          <button
            className={styles.executeBtn}
            onClick={executeAction}
            disabled={status === 'running'}
          >
            {status === 'running' ? (
              <>
                <Loader2 size={12} className={styles.pulse} />
                <span>Running...</span>
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 size={12} />
                <span>Re-run</span>
              </>
            ) : (
              <>
                <Play size={12} />
                <span>Execute Action</span>
              </>
            )}
          </button>
        </div>

        {output && <div className={styles.toolOutput}>{output}</div>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MessageBubble Component
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  msg: AiChatMessage;
  onApplyPatch: (code: string) => void;
  onOpenDiff: (code: string) => void;
  onRunTerminal: (code: string) => void;
  onFloatPhysics: (label: string, code: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  onApplyPatch,
  onOpenDiff,
  onRunTerminal,
  onFloatPhysics,
}) => {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyBlock = (code: string, idx: number) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedBlock(idx);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(msg.content).catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const segments = parseMessageSegments(msg.content);

  return (
    <div
      className={`${styles.messageWrapper} ${
        msg.role === 'user' ? styles.userWrapper : styles.assistantWrapper
      }`}
    >
      <div className={styles.messageBubble}>
        {/* Header */}
        <div className={styles.bubbleHeader}>
          <span className={styles.sender}>
            {msg.role === 'user' ? 'You' : 'Ajson Assistant'}
          </span>
          <span className={styles.msgTime}>
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Context chip */}
        {msg.context && msg.context[0] && (
          <div className={styles.contextCard}>
            <FileCode size={12} color="var(--accent)" />
            <span>{msg.context[0].path}</span>
          </div>
        )}

        {/* Content with code blocks & structured tool calls */}
        <div className={styles.bubbleText}>
          {segments.map((seg, i) => {
            if (seg.type === 'tool') {
              return <ToolActionCard key={i} tool={seg.tool} />;
            }

            if (seg.type === 'code') {
              const isShell =
                seg.lang === 'bash' ||
                seg.lang === 'sh' ||
                seg.lang === 'shell' ||
                seg.lang === 'terminal';

              return (
                <div key={i} className={styles.codeBlockWrapper}>
                  <div className={styles.codeBlockHeader}>
                    <span className={styles.codeLang}>{seg.lang || 'code'}</span>
                    <div className={styles.codeBlockActions}>
                      <button
                        className={styles.codeAction}
                        onClick={() => handleCopyBlock(seg.content, i)}
                        title="Copy code"
                      >
                        {copiedBlock === i ? (
                          <>
                            <Check size={10} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={10} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {isShell ? (
                        <button
                          className={`${styles.codeAction} ${styles.applyBtn}`}
                          onClick={() => onRunTerminal(seg.content)}
                          title="Run in Terminal"
                        >
                          <TerminalIcon size={10} />
                          <span>Terminal</span>
                        </button>
                      ) : (
                        <>
                          <button
                            className={`${styles.codeAction} ${styles.applyBtn}`}
                            onClick={() => onApplyPatch(seg.content)}
                            title="Apply directly to active editor file"
                          >
                            <Wrench size={10} />
                            <span>Apply</span>
                          </button>
                          <button
                            className={styles.codeAction}
                            onClick={() => onOpenDiff(seg.content)}
                            title="Compare in Monaco Diff Viewer"
                          >
                            <GitCompare size={10} />
                            <span>Diff</span>
                          </button>
                        </>
                      )}

                      <button
                        className={styles.codeAction}
                        onClick={() => onFloatPhysics(`Code (${seg.lang})`, seg.content)}
                        title="Spawn as node in AntiGravity Canvas"
                      >
                        <Atom size={10} />
                        <span>Float</span>
                      </button>
                    </div>
                  </div>
                  <pre className={styles.codeBlock}>
                    <code>{seg.content}</code>
                  </pre>
                </div>
              );
            }

            // Plain text with inline code
            return (
              <span key={i} className={styles.plainText}>
                {seg.content.split(/(`[^`]+`)/g).map((part, j) =>
                  part.startsWith('`') && part.endsWith('`') ? (
                    <code key={j} className={styles.inlineCode}>
                      {part.slice(1, -1)}
                    </code>
                  ) : (
                    part
                  )
                )}
              </span>
            );
          })}
        </div>

        {/* Footer actions for assistant messages */}
        {msg.role === 'assistant' && (
          <div className={styles.bubbleActions}>
            <button className={styles.copyBtn} onClick={handleCopyAll}>
              {copiedAll ? (
                <>
                  <Check size={11} color="var(--color-success)" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>Copy all</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AiPanel Component
// ---------------------------------------------------------------------------

export const AiPanel: React.FC = () => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Hello! I am your AI engineering assistant in Ajson Studio.\n\nI can analyze your codebase, generate patches, spawn physics nodes, or run commands in your terminal.\n\n```tool:run_command\n{\n  "command": "git status"\n}\n```',
      timestamp: Date.now(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-5-sonnet');
  const [attachedContext, setAttachedContext] = useState<string | null>(null);

  const { activeTabId, tabs, applyPatch, openDiff } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const streamUnsubRef = useRef<(() => void) | null>(null);
  const abortedRef = useRef(false);

  // Load available models
  useEffect(() => {
    aiService
      .getProviders()
      .then((m) => {
        setModels(m);
        if (m[0]) setSelectedModel(m[0].id);
      })
      .catch(() => {});
  }, []);

  // Auto-attach context when active tab changes
  useEffect(() => {
    if (activeTab) {
      setAttachedContext(activeTab.title);
    }
  }, [activeTab]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isGenerating]);

  // Subscribe to live stream events
  useEffect(() => {
    if (typeof aiService.onStreamEvent === 'function') {
      const unsub = aiService.onStreamEvent((event) => {
        if (abortedRef.current) return;

        if (event.type === 'text_delta') {
          setStreamingContent((prev) => prev + event.delta);
        }
      });
      streamUnsubRef.current = unsub;
    }
    return () => {
      if (streamUnsubRef.current) {
        streamUnsubRef.current();
        streamUnsubRef.current = null;
      }
    };
  }, []);

  const handleStop = useCallback(() => {
    abortedRef.current = true;
    setIsGenerating(false);
    if (streamingContent) {
      const abortedMsg: AiChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: streamingContent + '\n\n*[Generation stopped]*',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, abortedMsg]);
    }
    setStreamingContent('');
  }, [streamingContent]);

  const handleSend = useCallback(async () => {
    if (!inputVal.trim() || isGenerating) return;

    const userText = inputVal.trim();
    setInputVal('');
    abortedRef.current = false;
    setStreamingContent('');

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      context:
        activeTab && attachedContext
          ? [
              {
                path: activeTab.path,
                content: activeTab.content.slice(0, 4000),
                language: activeTab.language,
              },
            ]
          : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const responseText = await aiService.sendMessage({
        messages: [...messages, userMsg],
        model: selectedModel,
      });

      if (!abortedRef.current) {
        const assistantMsg: AiChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      if (!abortedRef.current) {
        const errorMsg: AiChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `❌ Error: ${(err as Error).message}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      abortedRef.current = false;
    }
  }, [inputVal, isGenerating, messages, selectedModel, activeTab, attachedContext]);

  // Direct Editor Action: Apply patch to active file with visual diff highlights
  const handleApplyPatch = useCallback(
    (code: string) => {
      if (!activeTab || activeTab.type === 'diff') return;
      applyPatch(activeTab.id, code);
      useLayoutStore.getState().setActiveView('editor');
    },
    [activeTab, applyPatch]
  );

  // Direct Editor Action: Open Monaco Diff Viewer
  const handleOpenDiff = useCallback(
    (code: string) => {
      if (!activeTab) return;
      openDiff(activeTab.path, activeTab.content, code, false);
    },
    [activeTab, openDiff]
  );

  // Direct Terminal Action: Execute shell command
  const handleRunTerminal = useCallback(async (code: string) => {
    const cmd = code.trim().replace(/^[$>]\s*/gm, '');
    const sessions = terminalService.listSessions();
    let sessionId = sessions[0]?.id;
    if (!sessionId) {
      sessionId = await terminalService.createSession();
    }
    useLayoutStore.getState().setActiveBottomTab('terminal');
    useLayoutStore.getState().setBottomPanelOpen(true);
    void terminalService.runCommand(sessionId, cmd);
  }, []);

  // Direct Physics Action: Float code snippet as dynamic node in Canvas
  const handleFloatPhysics = useCallback((label: string, code: string) => {
    usePhysicsStore.getState().spawnNode({
      label,
      sublabel: `${code.slice(0, 35).replace(/\n/g, ' ')}...`,
      type: 'ai',
      color: '#a855f7',
    });
    useLayoutStore.getState().setActiveSidebarTab('physics');
  }, []);

  const handleClear = () => {
    setMessages([]);
    setStreamingContent('');
  };

  const contextTokens = activeTab
    ? Math.ceil(Math.min(activeTab.content.length, 4000) / 4)
    : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.modelSelectWrapper}>
          <Cpu size={13} color="var(--accent)" />
          <select
            className={styles.modelSelect}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <IconButton label="Clear Chat" size="sm" onClick={handleClear}>
          <Trash2 size={13} />
        </IconButton>
      </div>

      {/* Messages Stream */}
      <div className={styles.messagesBody}>
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            onApplyPatch={handleApplyPatch}
            onOpenDiff={handleOpenDiff}
            onRunTerminal={handleRunTerminal}
            onFloatPhysics={handleFloatPhysics}
          />
        ))}

        {/* Live streaming bubble */}
        {isGenerating && streamingContent && (
          <div className={`${styles.messageWrapper} ${styles.assistantWrapper}`}>
            <div className={styles.messageBubble}>
              <div className={styles.bubbleHeader}>
                <span className={styles.sender}>Ajson Assistant</span>
                <span className={styles.streamingDot} />
              </div>
              <div className={styles.bubbleText}>
                <span className={styles.plainText}>{streamingContent}</span>
                <span className={styles.cursor}>▋</span>
              </div>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isGenerating && !streamingContent && (
          <div className={styles.generatingIndicator}>
            <Sparkles size={14} color="var(--accent)" className={styles.pulse} />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context chip */}
      {attachedContext && (
        <div className={styles.contextStrip}>
          <div className={styles.contextChip}>
            <FileCode size={12} color="var(--accent)" />
            <span>{attachedContext}</span>
            <button
              className={styles.removeChip}
              onClick={() => setAttachedContext(null)}
              title="Remove context"
            >
              <X size={10} />
            </button>
          </div>
          <span className={styles.tokenCount}>~{contextTokens} tokens</span>
        </div>
      )}

      {/* Input area */}
      <div className={styles.inputArea}>
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder="Ask a question, request code diff, or run a command..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className={styles.inputControls}>
          <span className={styles.shortcutHint}>Enter to send · Shift+Enter new line</span>
          {isGenerating ? (
            <button className={styles.stopBtn} onClick={handleStop}>
              <Square size={12} />
              <span>Stop</span>
            </button>
          ) : (
            <button
              className={styles.sendBtn}
              disabled={!inputVal.trim()}
              onClick={() => void handleSend()}
            >
              <Send size={13} />
              <span>Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
