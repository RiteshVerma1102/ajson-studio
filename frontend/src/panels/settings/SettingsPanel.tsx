import React, { useState } from 'react';
import {
  Moon,
  Sun,
  Contrast,
  Sparkles,
  Layout,
  Key,
  Info,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useLayoutStore } from '../../state/layoutStore';
import { aiService } from '../../services';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import styles from './SettingsPanel.module.css';

export const SettingsPanel: React.FC = () => {
  const {
    theme,
    setTheme,
    layoutPreset,
    applyLayoutPreset,
    resetPanelSizes,
    zenMode,
    toggleZenMode,
    setAboutOpen,
    setTourOpen,
  } = useLayoutStore();

  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [keySaved, setKeySaved] = useState<string | null>(null);

  const handleSaveKey = async (provider: 'anthropic' | 'openai') => {
    const val = provider === 'anthropic' ? anthropicKey : openAiKey;
    if (!val) return;
    await aiService.setApiKey(provider, val);
    setKeySaved(provider);
    setTimeout(() => setKeySaved(null), 2500);
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>
          <Sun size={14} color="var(--accent)" />
          <span>Color Theme</span>
        </h3>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.presetBtn} ${theme === 'dark' ? styles.activePreset : ''}`}
            onClick={() => setTheme('dark')}
          >
            <Moon size={14} />
            <span>Dark</span>
          </button>
          <button
            className={`${styles.presetBtn} ${theme === 'light' ? styles.activePreset : ''}`}
            onClick={() => setTheme('light')}
          >
            <Sun size={14} />
            <span>Light</span>
          </button>
          <button
            className={`${styles.presetBtn} ${theme === 'high-contrast' ? styles.activePreset : ''}`}
            onClick={() => setTheme('high-contrast')}
          >
            <Contrast size={14} />
            <span>High Contrast</span>
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>
          <Layout size={14} color="var(--color-info)" />
          <span>Layout Presets</span>
        </h3>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.presetBtn} ${layoutPreset === 'default' ? styles.activePreset : ''}`}
            onClick={() => applyLayoutPreset('default')}
          >
            <span>Default</span>
          </button>
          <button
            className={`${styles.presetBtn} ${layoutPreset === 'focus' ? styles.activePreset : ''}`}
            onClick={() => applyLayoutPreset('focus')}
          >
            <span>Focus</span>
          </button>
          <button
            className={`${styles.presetBtn} ${layoutPreset === 'agent-first' ? styles.activePreset : ''}`}
            onClick={() => applyLayoutPreset('agent-first')}
          >
            <span>Agent-First</span>
          </button>
        </div>

        <div className={styles.rowActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleZenMode}
          >
            {zenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw size={12} />}
            onClick={resetPanelSizes}
          >
            Reset Sizes
          </Button>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>
          <Key size={14} color="var(--color-warning)" />
          <span>AI Credentials (OS Keychain)</span>
        </h3>
        <div className={styles.secureNotice}>
          <ShieldCheck size={14} color="var(--color-success)" />
          <span>Keys are encrypted via Electron safeStorage; never written in plaintext.</span>
        </div>

        <div className={styles.keyRow}>
          <div className={styles.keyHeader}>
            <span>Anthropic API Key</span>
            {keySaved === 'anthropic' && <Badge variant="success">Saved</Badge>}
          </div>
          <div className={styles.inputFlex}>
            <input
              type="password"
              className={styles.keyInput}
              placeholder="sk-ant-..."
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!anthropicKey}
              onClick={() => void handleSaveKey('anthropic')}
            >
              Save
            </Button>
          </div>
        </div>

        <div className={styles.keyRow}>
          <div className={styles.keyHeader}>
            <span>OpenAI API Key</span>
            {keySaved === 'openai' && <Badge variant="success">Saved</Badge>}
          </div>
          <div className={styles.inputFlex}>
            <input
              type="password"
              className={styles.keyInput}
              placeholder="sk-..."
              value={openAiKey}
              onChange={(e) => setOpenAiKey(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!openAiKey}
              onClick={() => void handleSaveKey('openai')}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>
          <HelpCircle size={14} color="var(--fg-3)" />
          <span>Help & Diagnostics</span>
        </h3>
        <div className={styles.rowActions}>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Sparkles size={13} color="var(--accent)" />}
            onClick={() => setTourOpen(true)}
          >
            Replay Tour
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Info size={13} />}
            onClick={() => setAboutOpen(true)}
          >
            About Ajson
          </Button>
        </div>
      </div>
    </div>
  );
};
