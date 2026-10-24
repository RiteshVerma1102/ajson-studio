import React, { useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useCommandStore } from '../../state/commandStore';
import { Kbd } from '../Kbd/Kbd';
import styles from './CommandPalette.module.css';

export const CommandPalette: React.FC = () => {
  const { paletteOpen, closePalette, togglePalette, executeCommand, getCommandsList } =
    useCommandStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paletteOpen) {
      inputRef.current?.focus();
    }
  }, [paletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Primary: Ctrl+Shift+P or Cmd+Shift+P
      const isCmdShiftP =
        (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p');
      // Addition 7: Fallback F1 shortcut
      const isF1 = e.key === 'F1';

      if (isCmdShiftP || isF1) {
        e.preventDefault();
        togglePalette();
      }

      if (e.key === 'Escape' && paletteOpen) {
        closePalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, togglePalette, closePalette]);

  if (!paletteOpen) return null;

  const commands = getCommandsList();

  // Group commands by category
  const groups: Record<string, typeof commands> = {};
  for (const cmd of commands) {
    if (!groups[cmd.category]) {
      groups[cmd.category] = [];
    }
    groups[cmd.category]!.push(cmd);
  }

  return (
    <div
      className={styles.dialogBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      role="presentation"
    >
      <Command className={styles.commandRoot} label="Command Palette">
        <div className={styles.inputWrapper}>
          <Search size={16} />
          <Command.Input
            ref={inputRef}
            placeholder="Type a command or search..."
            className={styles.input}
          />
        </div>

        <Command.List className={styles.list}>
          <Command.Empty className={styles.empty}>No matching commands found.</Command.Empty>

          {Object.entries(groups).map(([category, items]) => (
            <Command.Group key={category} heading={category} className={styles.group}>
              {items.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={`${cmd.category} ${cmd.title} ${(cmd.keywords || []).join(' ')}`}
                  onSelect={() => executeCommand(cmd.id)}
                  className={styles.item}
                >
                  <div className={styles.itemLeft}>
                    <span className={styles.itemTitle}>{cmd.title}</span>
                  </div>

                  <div className={styles.shortcuts}>
                    {cmd.shortcut && <Kbd>{cmd.shortcut}</Kbd>}
                    {cmd.fallbackShortcut && <Kbd>{cmd.fallbackShortcut}</Kbd>}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
};
