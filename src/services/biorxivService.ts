import type { BioRxivPreprint, BioRxivSearchParams } from '@/types/preprints';

interface BioRxivSearchResponse {
  success: boolean;
  count: number;
  results: BioRxivPreprint[];
}

export async function searchBioRxiv(params: BioRxivSearchParams): Promise<BioRxivPreprint[]> {
  try {
    const response = await fetch('/api/search-preprints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data: BioRxivSearchResponse = await response.json();

    if (!data.success) {
      throw new Error('Search failed');
    }

    return data.results;
  } catch (error) {
    console.error('Error searching bioRxiv/medRxiv:', error);
    throw error;
  }
}

export async function searchBioRxivWithDefaults(query: string): Promise<BioRxivPreprint[]> {
  return searchBioRxiv({
    query,
    server: 'both',
    maxResults: 30,
  });
}
