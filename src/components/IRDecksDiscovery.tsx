 
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Star, Building2, FolderOpen } from 'lucide-react';
import type { IRDeck } from '@/types/ir-decks';

interface IRDecksDiscoveryProps {
  irDecks: IRDeck[];
  query: string;
  loading: boolean;
}

export const IRDecksDiscovery: React.FC<IRDecksDiscoveryProps> = ({
  query,
  irDecks,
  loading
}) => {
  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Sort by filing date (most recent first)
  const sortedDecks = [...irDecks].sort((a, b) => {
    const dateA = new Date(a.filingDate);
    const dateB = new Date(b.filingDate);
    return dateB.getTime() - dateA.getTime();
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading IR decks...</p>
        </div>
      </div>
    );
  }

  if (irDecks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No IR Decks Found</h3>
          <p className="text-muted-foreground">
            No investor relations materials found for "{query}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">Investor Relations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {irDecks.length} SEC filing{irDecks.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {sortedDecks.map((deck) => (
            <Card
              key={deck.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{deck.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {deck.company}
                        {deck.ticker && ` (${deck.ticker})`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRelevanceColor(deck.relevanceScore)}>
                      <Star className="h-3 w-3 mr-1" />
                      {deck.relevanceScore}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <FileText className="h-3 w-3 mr-1" />
                      {deck.filingType}
                    </Badge>
                    <Badge variant="secondary">{deck.filingDate}</Badge>
                    {deck.reportDate && deck.reportDate !== deck.filingDate && (
                      <Badge variant="outline">Report: {deck.reportDate}</Badge>
                    )}
                  </div>

                  {deck.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {deck.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-2">
                      {deck.documentUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(deck.documentUrl, '_blank');
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          View Document
                        </Button>
                      )}
                      {deck.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(deck.url, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          SEC Filing
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
  );
};
