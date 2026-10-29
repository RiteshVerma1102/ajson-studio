import { DiagnosticMarker, DiagnosticsFilter, DiagnosticsService } from './types';

export class DefaultDiagnosticsService implements DiagnosticsService {
  private markers: Map<string, DiagnosticMarker[]> = new Map();
  private listeners: Set<() => void> = new Set();

  private getKey(source: DiagnosticMarker['source'], uri: string): string {
    return `${source}::${uri}`;
  }

  list(filter?: DiagnosticsFilter): DiagnosticMarker[] {
    const all: DiagnosticMarker[] = [];
    for (const markerList of this.markers.values()) {
      all.push(...markerList);
    }

    if (!filter) return all;

    return all.filter((m) => {
      if (filter.severity && filter.severity.length > 0) {
        if (!filter.severity.includes(m.severity)) return false;
      }

      if (filter.currentFileOnly && filter.activeUri) {
        if (m.uri !== filter.activeUri) return false;
      }

      if (filter.query && filter.query.trim()) {
        const q = filter.query.toLowerCase();
        const matchesMsg = m.message.toLowerCase().includes(q);
        const matchesUri = m.uri.toLowerCase().includes(q);
        const matchesCode = m.code ? String(m.code).toLowerCase().includes(q) : false;
        if (!matchesMsg && !matchesUri && !matchesCode) return false;
      }

      return true;
    });
  }

  publish(source: DiagnosticMarker['source'], uri: string, markers: DiagnosticMarker[]): void {
    const key = this.getKey(source, uri);
    if (markers.length === 0) {
      this.markers.delete(key);
    } else {
      this.markers.set(key, markers);
    }
    this.notify();
  }

  clearSource(source: DiagnosticMarker['source']): void {
    for (const key of Array.from(this.markers.keys())) {
      if (key.startsWith(`${source}::`)) {
        this.markers.delete(key);
      }
    }
    this.notify();
  }

  clearUri(uri: string): void {
    for (const key of Array.from(this.markers.keys())) {
      if (key.endsWith(`::${uri}`)) {
        this.markers.delete(key);
      }
    }
    this.notify();
  }

  onDidChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch (err) {
        console.error('Error in diagnostics listener', err);
      }
    }
  }
}
