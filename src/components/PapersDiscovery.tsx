import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Star, Users } from 'lucide-react';
import type { PubMedArticle } from '@/services/pubmedAPI';
import type { ClinicalTrial } from '@/services/clinicalTrialsAPI';

interface PapersDiscoveryProps {
  trials: ClinicalTrial[];
  query: string;
}

export const PapersDiscovery: React.FC<PapersDiscoveryProps> = ({ query }) => {
  const [papers, setPapers] = useState<PubMedArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());

  const searchPapers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/search-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `${query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
          maxResults: 30
        })
      });
      
      const data = await response.json();
      setPapers(data.papers || []);
    } catch (error) {
      console.error('Failed to search papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaperSelect = (pmid: string) => {
    const newSelected = new Set(selectedPapers);
    if (newSelected.has(pmid)) {
      newSelected.delete(pmid);
    } else {
      newSelected.add(pmid);
    }
    setSelectedPapers(newSelected);
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Related Research Papers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Find academic papers related to your clinical trial search
          </p>
        </div>
        <Button onClick={searchPapers} disabled={loading}>
          <FileText className="mr-2 h-4 w-4" />
          {loading ? 'Searching...' : 'Find Papers'}
        </Button>
      </div>

      {papers.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Found {papers.length} papers
            </p>
            {selectedPapers.size > 0 && (
              <Button variant="outline" size="sm">
                Export Selected ({selectedPapers.size})
              </Button>
            )}
          </div>
          
          <div className="grid gap-4">
            {papers.map((paper) => (
              <Card 
                key={paper.pmid} 
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  selectedPapers.has(paper.pmid) ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handlePaperSelect(paper.pmid)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{paper.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {paper.authors.slice(0, 3).join(', ')}
                          {paper.authors.length > 3 && ` et al.`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRelevanceColor(paper.relevanceScore)}>
                        <Star className="h-3 w-3 mr-1" />
                        {paper.relevanceScore}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{paper.journal}</Badge>
                      <Badge variant="secondary">{paper.publicationDate}</Badge>
                      {paper.nctNumber && (
                        <Badge variant="default">{paper.nctNumber}</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm line-clamp-3 text-muted-foreground">
                      {paper.abstract}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a 
                          href={paper.fullTextLinks.pubmed} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          PubMed
                        </a>
                      </Button>
                      
                      {paper.fullTextLinks.doi && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a 
                            href={paper.fullTextLinks.doi} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            DOI
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {papers.length === 0 && !loading && (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Click "Find Papers" to search for academic papers related to your clinical trials
          </p>
        </div>
      )}
    </div>
  );
};
