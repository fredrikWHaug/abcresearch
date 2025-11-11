import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Star, Building2, Megaphone, Plus, Check } from 'lucide-react';
import type { PressRelease } from '@/types/press-releases';

interface PressReleasesDiscoveryProps {
  pressReleases: PressRelease[];
  query: string;
  loading: boolean;
  onAddPressReleaseToContext?: (pressRelease: PressRelease) => void;
  isPressReleaseInContext?: (id: string) => boolean;
}

export const PressReleasesDiscovery: React.FC<PressReleasesDiscoveryProps> = ({
  query,
  pressReleases,
  loading,
  onAddPressReleaseToContext,
  isPressReleaseInContext
}) => {

  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Sort by release date (most recent first)
  const sortedReleases = [...pressReleases].sort((a, b) => {
    const dateA = new Date(a.releaseDate);
    const dateB = new Date(b.releaseDate);
    return dateB.getTime() - dateA.getTime();
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading press releases...</p>
        </div>
      </div>
    );
  }

  if (pressReleases.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Press Releases Found</h3>
          <p className="text-muted-foreground">
            No press releases match your search for "{query}"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">Press Releases</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {pressReleases.length} press release{pressReleases.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {sortedReleases.map((release) => (
            <Card
              key={release.id}
              className={`hover:shadow-lg transition-shadow ${
                isPressReleaseInContext?.(release.id) ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{release.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {release.company}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRelevanceColor(release.relevanceScore)}>
                      <Star className="h-3 w-3 mr-1" />
                      {release.relevanceScore}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        <FileText className="h-3 w-3 mr-1" />
                        {release.source}
                      </Badge>
                      <Badge variant="secondary">{release.releaseDate}</Badge>
                      {release.affectedIndication && (
                        <Badge variant="default">{release.affectedIndication}</Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {release.summary}
                    </p>

                    {release.keyAnnouncements && release.keyAnnouncements.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {release.keyAnnouncements.map((announcement, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {announcement}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {release.mentionedDrugs && release.mentionedDrugs.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">Mentioned drugs: </span>
                        <span className="text-muted-foreground">
                          {release.mentionedDrugs.join(', ')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      {release.financialImpact && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Financial impact: </span>
                          {release.financialImpact}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {onAddPressReleaseToContext && (
                          <Button
                            variant={isPressReleaseInContext?.(release.id) ? "default" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isPressReleaseInContext?.(release.id)) {
                                onAddPressReleaseToContext(release);
                              }
                            }}
                            disabled={isPressReleaseInContext?.(release.id)}
                            className={isPressReleaseInContext?.(release.id) ? "bg-blue-600 hover:bg-blue-600" : ""}
                          >
                            {isPressReleaseInContext?.(release.id) ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                In Context
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Add to Context
                              </>
                            )}
                          </Button>
                        )}
                        {release.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(release.url, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View Release
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
