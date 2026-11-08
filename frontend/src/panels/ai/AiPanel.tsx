/**
 * AiPanel — Claude-style AI assistant panel.
 *
 * Features:
 * - Real-time streaming response via onStreamEvent
 * - Markdown rendering with syntax-highlighted code blocks
 * - Copy button on every code block
 * - "Apply patch" button: patches active Monaco file from code blocks
 * - Active file context injection chip
 * - Abort streaming with Stop button
 * - Model selector dropdown
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
} from 'lucide-react';
import { aiService, AiChatMessage, AiModelConfig } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './AiPanel.module.css';

// ---------------------------------------------------------------------------
// Markdown code-block renderer (lightweight, no extra dep required)
// ---------------------------------------------------------------------------

function parseCodeBlocks(text: string): Array<{ type: 'text' | 'code'; content: string; lang?: string }> {
  const segments: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', lang: match[1] || 'plaintext', content: match[2]?.trim() ?? '' });
    lastIndex = fenceRe.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// MessageBubble component
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  msg: AiChatMessage;
  onApplyPatch: (code: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, onApplyPatch }) => {
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

  const segments = parseCodeBlocks(msg.content);

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

        {/* Content with code blocks */}
        <div className={styles.bubbleText}>
          {segments.map((seg, i) => {
            if (seg.type === 'code') {
              const isFirst = seg.lang !== 'plaintext';
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
                          <><Check size={10} /><span>Copied</span></>
                        ) : (
                          <><Copy size={10} /><span>Copy</span></>
                        )}
                      </button>
                      {isFirst && (
                        <button
                          className={`${styles.codeAction} ${styles.applyBtn}`}
                          onClick={() => onApplyPatch(seg.content)}
                          title="Apply to active editor file"
                        >
                          <Wrench size={10} /><span>Apply</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className={styles.codeBlock}>
                    <code>{seg.content}</code>
                  </pre>
                </div>
              );
            }
            // Plain text — render inline code with backtick syntax
            return (
              <span key={i} className={styles.plainText}>
                {seg.content.split(/(`[^`]+`)/g).map((part, j) =>
                  part.startsWith('`') && part.endsWith('`') ? (
                    <code key={j} className={styles.inlineCode}>
                      {part.slice(1, -1)}
                    </code>
                  ) : (
                    part
                  ),
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
                <><Check size={11} color="var(--color-success)" /><span>Copied</span></>
              ) : (
                <><Copy size={11} /><span>Copy all</span></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AiPanel (main component)
// ---------------------------------------------------------------------------

export const AiPanel: React.FC = () => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Hello! I am your AI engineering assistant in Ajson Studio.\n\nAttach active files, refactor selections, generate tests, or ask architectural questions.\n\n```typescript\n// Example: ask me to refactor this\nconst add = (a: number, b: number) => a + b;\n```',
      timestamp: Date.now(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-5-sonnet');
  const [attachedContext, setAttachedContext] = useState<string | null>(null);

  const { activeTabId, tabs, updateContent } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const streamUnsubRef = useRef<(() => void) | null>(null);
  const abortedRef = useRef(false);

  // Load models
  useEffect(() => {
    aiService.getProviders().then((m) => {
      setModels(m);
      if (m[0]) setSelectedModel(m[0].id);
    }).catch(() => {});
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

  // Subscribe to stream events
  useEffect(() => {
    if (typeof aiService.onStreamEvent === 'function') {
      const unsub = aiService.onStreamEvent((event) => {
        if (abortedRef.current) return;

        if (event.type === 'text_delta') {
          setStreamingContent((prev) => prev + event.delta);
        } else if (event.type === 'done') {
          // Finalized by handleSend after sendMessage resolves
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

  // Apply patch to active editor file
  const handleApplyPatch = useCallback(
    (code: string) => {
      if (!activeTab || activeTab.type === 'diff') return;
      updateContent(activeTab.id, code);
    },
    [activeTab, updateContent],
  );

  const handleClear = () => {
    setMessages([]);
    setStreamingContent('');
  };

  // Estimate token count (rough: 1 token ≈ 4 chars)
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

      {/* Messages */}
      <div className={styles.messagesBody}>
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onApplyPatch={handleApplyPatch} />
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

        {/* Thinking indicator (before first token) */}
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
          placeholder="Ask a question or request a code refactor..."
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
