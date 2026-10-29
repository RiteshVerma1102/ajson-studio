import { z } from 'zod';
import { SearchQuery, SearchQuerySchema, SearchMatch, SearchMatchSchema } from '../domain';

export interface SearchService {
  searchText(query: SearchQuery): Promise<SearchMatch[]>;
}

export const SearchTextRequestSchema = SearchQuerySchema;
export const SearchTextResponseSchema = z.array(SearchMatchSchema);
