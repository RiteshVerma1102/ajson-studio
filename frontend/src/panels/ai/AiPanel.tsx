import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { aiService, AiChatMessage, AiModelConfig } from '../../services';
import { useEditorStore } from '../../state/editorStore';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './AiPanel.module.css';

export const AiPanel: React.FC = () => {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Hello! I am your AI engineering assistant in Ajson Studio. Attach active files, refactor selections, generate tests, or ask architectural questions.',
      timestamp: Date.now(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [models, setModels] = useState<AiModelConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-5-sonnet');
  const [attachedContext, setAttachedContext] = useState<string | null>(null);

  const { activeTabId, tabs } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    aiService.getProviders().then((m) => {
      setModels(m);
      if (m[0]) setSelectedModel(m[0].id);
    });
  }, []);

  useEffect(() => {
    if (activeTab) {
      setAttachedContext(activeTab.title);
    }
  }, [activeTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSend = async () => {
    if (!inputVal.trim() || isGenerating) return;

    const userText = inputVal.trim();
    setInputVal('');

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      context: activeTab && attachedContext ? [
        {
          path: activeTab.path,
          content: activeTab.content.slice(0, 3000),
          language: activeTab.language,
        },
      ] : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const responseText = await aiService.sendMessage({
        messages: [...messages, userMsg],
        model: selectedModel,
      });

      const assistantMsg: AiChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: AiChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Error: ${(err as Error).message}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className={styles.container}>
      {/* Model Selection & Controls Header */}
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
          <div
            key={m.id}
            className={`${styles.messageWrapper} ${
              m.role === 'user' ? styles.userWrapper : styles.assistantWrapper
            }`}
          >
            <div className={styles.messageBubble}>
              <div className={styles.bubbleHeader}>
                <span className={styles.sender}>
                  {m.role === 'user' ? 'You' : 'Ajson Assistant'}
                </span>
                <span className={styles.msgTime}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {m.context && m.context[0] && (
                <div className={styles.contextCard}>
                  <FileCode size={12} color="var(--accent)" />
                  <span>{m.context[0].path}</span>
                </div>
              )}

              <div className={styles.bubbleText}>{m.content}</div>

              {m.role === 'assistant' && (
                <div className={styles.bubbleActions}>
                  <button
                    className={styles.copyBtn}
                    onClick={() => handleCopy(m.id, m.content)}
                  >
                    {copiedId === m.id ? (
                      <>
                        <Check size={11} color="var(--color-success)" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className={styles.generatingIndicator}>
            <Sparkles size={14} color="var(--accent)" className={styles.pulse} />
            <span>Generating response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Chip Area */}
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
          <span className={styles.tokenCount}>Tokens: ~1.2k</span>
        </div>
      )}

      {/* Prompt Input Box */}
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
          <span className={styles.shortcutHint}>Press Enter to send, Shift+Enter for new line</span>
          {isGenerating ? (
            <button
              className={styles.stopBtn}
              onClick={() => setIsGenerating(false)}
            >
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
