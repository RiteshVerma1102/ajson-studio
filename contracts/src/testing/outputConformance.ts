import { OutputService } from '../services/output';

export async function runOutputConformanceTests(
  createService: () => Promise<OutputService> | OutputService
) {
  const output = await createService();

  output.append('Tasks', 'Task conformance line', 'info');
  const lines = output.list('Tasks');
  const found = lines.some((l) => l.text === 'Task conformance line');
  if (!found) {
    throw new Error('append failed to record line');
  }

  output.clear('Tasks');
  const clearedLines = output.list('Tasks');
  if (clearedLines.length !== 0) {
    throw new Error('clear failed to empty lines');
  }

  return true;
}
