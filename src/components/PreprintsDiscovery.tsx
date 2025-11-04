import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Star, Users, Flask } from 'lucide-react';
import type { BioRxivPreprint } from '@/types/preprints';

interface PreprintsDiscoveryProps {
  preprints: BioRxivPreprint[];
  query: string;
  loading: boolean;
}

export const PreprintsDiscovery: React.FC<PreprintsDiscoveryProps> = ({
  preprints,
  query,
  loading
}) => {
  const [selectedPreprints, setSelectedPreprints] = useState<Set<string>>(new Set());

  const handlePreprintSelect = (doi: string) => {
    const newSelected = new Set(selectedPreprints);
    if (newSelected.has(doi)) {
      newSelected.delete(doi);
    } else {
      newSelected.add(doi);
    }
    setSelectedPreprints(newSelected);
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getServerBadgeColor = (server: 'biorxiv' | 'medrxiv') => {
    return server === 'biorxiv' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  // Sort preprints by publication date (most recent first)
  const sortedPreprints = [...preprints].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading preprints...</p>
        </div>
      </div>
    );
  }

  if (preprints.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Flask className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Preprints Found</h3>
          <p className="text-muted-foreground">
            No bioRxiv/medRxiv preprints match your search for "{query}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">Preprints Discovery</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {preprints.length} preprint{preprints.length !== 1 ? 's' : ''} from bioRxiv/medRxiv
        </p>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {selectedPreprints.size > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm">
                Export Selected ({selectedPreprints.size})
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {sortedPreprints.map((preprint) => (
              <Card
                key={preprint.doi}
                className={`hover:shadow-lg transition-shadow cursor-pointer ${
                  selectedPreprints.has(preprint.doi) ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handlePreprintSelect(preprint.doi)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{preprint.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {preprint.authors.slice(0, 3).join(', ')}
                          {preprint.authors.length > 3 && ` et al.`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRelevanceColor(preprint.relevanceScore)}>
                        <Star className="h-3 w-3 mr-1" />
                        {preprint.relevanceScore}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getServerBadgeColor(preprint.server)}>
                        <Flask className="h-3 w-3 mr-1" />
                        {preprint.server === 'biorxiv' ? 'bioRxiv' : 'medRxiv'}
                      </Badge>
                      <Badge variant="outline">{preprint.category}</Badge>
                      <Badge variant="secondary">{preprint.date}</Badge>
                      <Badge variant="outline">v{preprint.version}</Badge>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {preprint.abstract}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Corresponding: {preprint.authorCorresponding}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(preprint.fullTextLinks.doi, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View DOI
                        </Button>
                        {preprint.fullTextLinks.biorxiv && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(preprint.fullTextLinks.biorxiv, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            bioRxiv
                          </Button>
                        )}
                        {preprint.fullTextLinks.medrxiv && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(preprint.fullTextLinks.medrxiv, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            medRxiv
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
