import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { outputService, OutputChannel, OutputLine } from '../../services';
import { IconButton } from '../../components/IconButton/IconButton';
import styles from './OutputPanel.module.css';

const CHANNELS: OutputChannel[] = ['Tasks', 'Git', 'Ajson'];

export const OutputPanel: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<OutputChannel>('Tasks');
  const [lines, setLines] = useState<OutputLine[]>([]);

  const loadLines = () => {
    setLines(outputService.list(activeChannel));
  };

  useEffect(() => {
    loadLines();
    const unbind = outputService.onDidAppend((line) => {
      if (line.channel === activeChannel) {
        setLines((prev) => [...prev, line]);
      }
    });
    return () => unbind();
  }, [activeChannel]);

  const handleClear = () => {
    outputService.clear(activeChannel);
    setLines([]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.channelSelect}>
          <label htmlFor="output-channel-select" className={styles.label}>
            Channel:
          </label>
          <select
            id="output-channel-select"
            className={styles.select}
            value={activeChannel}
            onChange={(e) => setActiveChannel(e.target.value as OutputChannel)}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <IconButton label="Clear Output" size="sm" onClick={handleClear}>
          <Trash2 size={13} />
        </IconButton>
      </div>

      <div className={styles.logBody}>
        {lines.map((l) => (
          <div key={l.id} className={`${styles.logRow} ${styles[l.level]}`}>
            <span className={styles.timestamp}>
              [{new Date(l.timestamp).toLocaleTimeString()}]
            </span>
            <span className={styles.text}>{l.text}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div className={styles.empty}>Zero output recorded in channel [{activeChannel}]</div>
        )}
      </div>
    </div>
  );
};
