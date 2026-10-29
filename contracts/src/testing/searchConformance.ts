import { SearchService } from '../services/search';

export async function runSearchConformanceTests(
  createService: () => Promise<SearchService> | SearchService
) {
  const search = await createService();

  // Search for common keyword
  const results = await search.searchText({ query: 'export' });
  if (!Array.isArray(results)) {
    throw new Error('searchText did not return an array');
  }

  // Search with empty query returns empty
  const emptyResults = await search.searchText({ query: '' });
  if (emptyResults.length !== 0) {
    throw new Error('searchText with empty query should return empty array');
  }

  return true;
}
