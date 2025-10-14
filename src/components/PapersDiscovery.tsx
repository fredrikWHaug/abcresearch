import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Star, Users } from 'lucide-react';
import type { PubMedArticle } from '@/services/pubmedAPI';
import type { ClinicalTrial } from '@/types/trials';

interface PapersDiscoveryProps {
  trials: ClinicalTrial[];
  query: string;
  papers: PubMedArticle[];
  loading: boolean;
}

export const PapersDiscovery: React.FC<PapersDiscoveryProps> = ({ query, papers, loading }) => {
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());


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

  // Sort papers by publication date (most recent first)
  const sortedPapers = [...papers].sort((a, b) => {
    const dateA = new Date(a.publicationDate);
    const dateB = new Date(b.publicationDate);
    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
  });

  return (
    <div className="h-full flex flex-col">
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {papers.length > 0 && (
          <div className="space-y-4">
            {selectedPapers.size > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm">
                  Export Selected ({selectedPapers.size})
                </Button>
              </div>
            )}
            
            <div className="space-y-4">
              {sortedPapers.map((paper) => (
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
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600">No papers found for: "{query}"</p>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
