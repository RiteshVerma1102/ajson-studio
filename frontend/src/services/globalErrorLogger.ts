import { outputService } from './index';
import { safeStorage } from '../state/storage';

const EMERGENCY_BUFFER_KEY = 'ajson_emergency_unsaved_buffer_v1';

export function setupGlobalErrorLogging(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const errorHandler = (event: ErrorEvent) => {
    const errorMsg = event.error?.stack || event.message || 'Unknown global error';
    outputService.append('Ajson', `[Global Error] ${errorMsg}`, 'error');
    persistEmergencySnapshot();
  };

  const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason.stack : String(event.reason);
    outputService.append('Ajson', `[Unhandled Promise Rejection] ${reason}`, 'error');
    persistEmergencySnapshot();
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', unhandledRejectionHandler);

  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
  };
}

/**
 * Saves a fallback snapshot of active unsaved editor buffers if available
 */
function persistEmergencySnapshot(): void {
  try {
    const raw = safeStorage.getItem('ajson_editor_tabs_v1');
    if (raw) {
      safeStorage.setItem(EMERGENCY_BUFFER_KEY, raw);
    }
  } catch {
    // Avoid re-throwing during emergency handling
  }
}
