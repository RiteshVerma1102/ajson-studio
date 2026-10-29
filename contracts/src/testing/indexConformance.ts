import { IndexService } from '../services/indexService';

export async function runIndexConformanceTests(
  createService: () => Promise<IndexService> | IndexService
) {
  const indexer = await createService();

  await indexer.indexWorkspace();
  const status = await indexer.getStatus();
  if (typeof status.isIndexing !== 'boolean') {
    throw new Error('getStatus returned invalid status');
  }

  const symbols = await indexer.searchSymbols('test');
  if (!Array.isArray(symbols)) {
    throw new Error('searchSymbols did not return an array');
  }

  return true;
}
