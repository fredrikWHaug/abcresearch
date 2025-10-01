// PubMed API Service
// Integrates with existing clinical trial search to find related academic papers

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  doi?: string;
  nctNumber?: string;
  relevanceScore: number;
  fullTextLinks: {
    pubmed: string;
    doi?: string;
    pmc?: string;
  };
}

export interface PubMedSearchParams {
  query: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
}

export class PubMedAPI {
  private readonly BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly API_KEY = import.meta.env.VITE_PUBMED_API_KEY || '';
  private readonly EMAIL = import.meta.env.VITE_PUBMED_EMAIL || 'your-email@example.com';

  /**
   * Search PubMed for papers related to clinical trials
   * Uses server-side API to avoid CORS issues
   */
  async searchPapers(params: PubMedSearchParams): Promise<PubMedArticle[]> {
    try {
      const response = await fetch('/api/search-papers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.papers || [];
    } catch (error) {
      console.error('PubMed search error:', error);
      throw new Error('Failed to search PubMed');
    }
  }

  /**
   * Find papers for a specific clinical trial
   */
  async findPapersForTrial(nctId: string): Promise<PubMedArticle[]> {
    const query = `${nctId}[Title/Abstract] OR ${nctId}[Secondary Source ID]`;
    return this.searchPapers({ query, maxResults: 10 });
  }

  /**
   * Search for papers by drug and condition
   */
  async searchByDrugCondition(drug: string, condition: string): Promise<PubMedArticle[]> {
    const query = `"${drug}" AND "${condition}" AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`;
    return this.searchPapers({ 
      query, 
      maxResults: 20,
      startDate: '2020/01/01'
    });
  }

  /**
   * Parse XML response from PubMed
   */
  private parseArticlesXML(xmlData: string): PubMedArticle[] {
    const articles: PubMedArticle[] = [];
    
    // Extract each PubmedArticle block
    const articleMatches = xmlData.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
    
    for (const articleXml of articleMatches) {
      const article: PubMedArticle = {
        pmid: this.extractXMLValue(articleXml, 'PMID') || '',
        title: this.extractXMLValue(articleXml, 'ArticleTitle') || '',
        abstract: this.extractXMLValue(articleXml, 'AbstractText') || '',
        journal: this.extractXMLValue(articleXml, 'Title') || '',
        publicationDate: this.extractPublicationDate(articleXml),
        doi: this.extractXMLValue(articleXml, 'ELocationID') || undefined,
        authors: this.extractAuthors(articleXml),
        nctNumber: this.extractNCTNumber(articleXml),
        relevanceScore: this.calculateRelevanceScore(articleXml),
        fullTextLinks: {
          pubmed: `https://pubmed.ncbi.nlm.nih.gov/${this.extractXMLValue(articleXml, 'PMID')}/`
        }
      };
      
      if (article.doi) {
        article.fullTextLinks.doi = `https://doi.org/${article.doi}`;
      }
      
      articles.push(article);
    }
    
    return articles;
  }

  private extractXMLValue(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractPublicationDate(xml: string): string {
    const year = this.extractXMLValue(xml, 'Year') || '';
    const month = this.extractXMLValue(xml, 'Month') || '01';
    const day = this.extractXMLValue(xml, 'Day') || '01';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private extractAuthors(xml: string): string[] {
    const authors: string[] = [];
    const authorMatches = xml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || [];
    
    for (const authorXml of authorMatches) {
      const lastName = this.extractXMLValue(authorXml, 'LastName') || '';
      const foreName = this.extractXMLValue(authorXml, 'ForeName') || '';
      if (lastName) {
        authors.push(`${lastName} ${foreName}`.trim());
      }
    }
    
    return authors.slice(0, 5); // Limit to first 5 authors
  }

  private extractNCTNumber(xml: string): string | undefined {
    const nctMatch = xml.match(/NCT\d{8}/);
    return nctMatch ? nctMatch[0] : undefined;
  }

  private calculateRelevanceScore(xml: string): number {
    let score = 50; // Base score
    
    // Premium journal bonus
    const journal = this.extractXMLValue(xml, 'Title') || '';
    const premiumJournals = ['New England Journal', 'JAMA', 'Lancet', 'Nature Medicine'];
    if (premiumJournals.some(j => journal.includes(j))) {
      score += 30;
    }
    
    // Phase 3 trial bonus
    if (xml.includes('Clinical Trial, Phase III')) {
      score += 20;
    }
    
    // Recent publication bonus
    const year = parseInt(this.extractXMLValue(xml, 'Year') || '0');
    const currentYear = new Date().getFullYear();
    if (currentYear - year <= 2) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }
}

export const pubmedAPI = new PubMedAPI();
