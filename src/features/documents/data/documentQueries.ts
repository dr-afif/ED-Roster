import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/platform/query';
import { supabase } from '@/platform/supabase';
import type { Database } from '@/platform/supabase';

export type DocumentRecordRow = Database['public']['Tables']['document_records']['Row'];

export interface DocumentFilters {
  category?: string;
  search?: string;
}

export function useDocumentRecordsQuery(filters?: DocumentFilters) {
  return useQuery({
    queryKey: queryKeys.documents.catalog(filters as Record<string, string>),
    queryFn: async () => {
      let query = supabase
        .from('document_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.category && filters.category !== 'all') {
        query = query.eq('document_category', filters.category);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!filters?.search) return data;

      const q = filters.search.toLowerCase().trim();
      return data.filter(
        (doc) =>
          doc.file_name.toLowerCase().includes(q) ||
          doc.document_category.toLowerCase().includes(q) ||
          doc.sha256.toLowerCase().includes(q),
      );
    },
    staleTime: 1000 * 30,
  });
}
