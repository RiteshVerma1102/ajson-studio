import { DiagnosticsService } from '../services/diagnostics';
import { DiagnosticMarker } from '../domain';

export async function runDiagnosticsConformanceTests(
  createService: () => Promise<DiagnosticsService> | DiagnosticsService
) {
  const diagnostics = await createService();

  const testMarker: DiagnosticMarker = {
    source: 'test-source',
    uri: 'src/test.ts',
    message: 'Conformance warning',
    severity: 'warning',
    startLineNumber: 10,
    startColumn: 1,
    endLineNumber: 10,
    endColumn: 20,
  };

  diagnostics.publish('test-source', 'src/test.ts', [testMarker]);
  const list = diagnostics.list({ activeUri: 'src/test.ts' });
  const found = list.some((m) => m.message === 'Conformance warning');
  if (!found) {
    throw new Error('publish failed to add marker');
  }

  diagnostics.clearSource('test-source');
  const clearedList = diagnostics.list({ activeUri: 'src/test.ts' });
  const stillExists = clearedList.some((m) => m.message === 'Conformance warning');
  if (stillExists) {
    throw new Error('clearSource failed to remove marker');
  }

  return true;
}
