import { OutputChannel, OutputLine, OutputService } from './types';

export class DefaultOutputService implements OutputService {
  private channels: Map<OutputChannel, OutputLine[]> = new Map();
  private listeners: Set<(line: OutputLine) => void> = new Set();

  constructor() {
    this.channels.set('Tasks', []);
    this.channels.set('Git', []);
    this.channels.set('Ajson', []);
  }

  append(channel: OutputChannel, text: string, level: OutputLine['level'] = 'info'): void {
    const list = this.channels.get(channel) || [];
    const line: OutputLine = {
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channel,
      text,
      level,
      timestamp: Date.now(),
    };

    list.push(line);
    // Keep max 5000 lines per channel to avoid memory leaks
    if (list.length > 5000) {
      list.shift();
    }
    this.channels.set(channel, list);

    for (const cb of this.listeners) {
      try {
        cb(line);
      } catch (err) {
        console.error('Error in output listener', err);
      }
    }
  }

  clear(channel: OutputChannel): void {
    this.channels.set(channel, []);
  }

  list(channel: OutputChannel): OutputLine[] {
    return this.channels.get(channel) || [];
  }

  onDidAppend(cb: (line: OutputLine) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
