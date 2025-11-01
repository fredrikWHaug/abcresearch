import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import type { WatchedFeed, TimelineItem, TrialUpdate } from '@/types/rss-feed';
import { ExternalLink, Plus, Trash2, RefreshCw, Calendar, AlertCircle } from 'lucide-react';

export function RealtimeFeed() {
  const [feeds, setFeeds] = useState<WatchedFeed[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [newFeedLabel, setNewFeedLabel] = useState('');
  const [selectedFeed, setSelectedFeed] = useState<number | null>(null);
  const [refreshingFeedId, setRefreshingFeedId] = useState<number | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string>('');
  const [validatingFeed, setValidatingFeed] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [editingFeed, setEditingFeed] = useState<WatchedFeed | null>(null);
  const [editSearchTerm, setEditSearchTerm] = useState('');
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => {
    loadFeeds();
    loadUpdates();
  }, []);

  const loadFeeds = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/rss-feed-watch', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFeeds(data.feeds);
      }
    } catch (error) {
      console.error('Failed to load feeds:', error);
    }
  };

  const loadUpdates = async (feedId?: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // When viewing a specific feed, load ALL updates (no date filter)
      // When viewing all feeds, show last 30 days
      const url = feedId 
        ? `/api/rss-feed-updates?feedId=${feedId}&days=9999`
        : '/api/rss-feed-updates?days=30';

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTimeline(data.timeline);
      }
    } catch (error) {
      console.error('Failed to load updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateRssFeed = async (searchTerm: string): Promise<{ valid: boolean; error?: string; count?: number }> => {
    try {
      // Build RSS URL
      const rssUrl = `https://clinicaltrials.gov/api/rss?intr=${encodeURIComponent(searchTerm)}&locStr=USA&country=US&dateField=LastUpdatePostDate`;
      
      // Test fetch the RSS feed
      const response = await fetch(rssUrl);
      if (!response.ok) {
        return { valid: false, error: 'Failed to fetch RSS feed from ClinicalTrials.gov' };
      }

      const xmlText = await response.text();
      
      // Basic XML validation - check if it contains RSS/feed structure
      if (!xmlText.includes('<rss') && !xmlText.includes('<feed')) {
        return { valid: false, error: 'Invalid RSS feed format' };
      }

      // Count items to give feedback
      const itemMatches = xmlText.match(/<item>/g);
      const count = itemMatches ? itemMatches.length : 0;

      return { valid: true, count };
    } catch (error) {
      console.error('RSS validation error:', error);
      return { valid: false, error: 'Failed to validate RSS feed. Please try again.' };
    }
  };

  const handleAddFeed = async () => {
    if (!newSearchTerm.trim()) return;

    setValidationError('');
    setValidatingFeed(true);

    try {
      // Validate RSS feed first
      const validation = await validateRssFeed(newSearchTerm.trim());
      
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid RSS feed');
        setValidatingFeed(false);
        return;
      }

      // Show success feedback
      if (validation.count === 0) {
        setValidationError('⚠️ Feed is valid but currently has no trials. You can still add it.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/rss-feed-watch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          searchTerm: newSearchTerm.trim(),
          label: newFeedLabel || `${newSearchTerm.trim()} trials`,
          locStr: 'USA',
          country: 'US',
          dateField: 'LastUpdatePostDate',
        }),
      });

      if (response.ok) {
        setNewSearchTerm('');
        setNewFeedLabel('');
        setValidationError('');
        setShowAddModal(false);
        await loadFeeds();
      }
    } catch (error) {
      console.error('Failed to add feed:', error);
      setValidationError('Failed to add feed. Please try again.');
    } finally {
      setValidatingFeed(false);
    }
  };

  const handleEditFeed = (feed: WatchedFeed) => {
    setEditingFeed(feed);
    // Extract search term from URL
    const url = new URL(feed.feed_url);
    const searchTerm = url.searchParams.get('intr') || '';
    setEditSearchTerm(searchTerm);
    setEditLabel(feed.label);
  };

  const handleSaveEdit = async () => {
    if (!editingFeed || !editSearchTerm.trim()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Build new RSS URL
      const newFeedUrl = `https://clinicaltrials.gov/api/rss?intr=${encodeURIComponent(editSearchTerm.trim())}&locStr=USA&country=US&dateField=LastUpdatePostDate`;

      const response = await fetch('/api/rss-feed-watch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          feedId: editingFeed.id,
          feedUrl: newFeedUrl,
          label: editLabel || `${editSearchTerm.trim()} trials`,
        }),
      });

      if (response.ok) {
        setEditingFeed(null);
        setEditSearchTerm('');
        setEditLabel('');
        await loadFeeds();
        // Reload updates if we're viewing this feed
        if (selectedFeed === editingFeed.id) {
          await loadUpdates(editingFeed.id);
        }
      }
    } catch (error) {
      console.error('Failed to update feed:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingFeed(null);
    setEditSearchTerm('');
    setEditLabel('');
  };

  const handleDeleteFeed = async (feedId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/rss-feed-watch', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ feedId }),
      });

      if (response.ok) {
        await loadFeeds();
        if (selectedFeed === feedId) {
          setSelectedFeed(null);
          loadUpdates();
        }
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
    }
  };

  const handleRefreshFeed = async (feedId: number) => {
    try {
      setRefreshingFeedId(feedId);
      setRefreshMessage('Checking for updates...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/rss-feed-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ feedId }),
      });

      if (response.ok) {
        const data = await response.json();
        setRefreshMessage(data.message);
        
        // Reload updates to show new ones
        await loadUpdates(selectedFeed === feedId ? feedId : undefined);
        
        // Clear message after 3 seconds
        setTimeout(() => {
          setRefreshMessage('');
        }, 3000);
      } else {
        setRefreshMessage('Failed to refresh feed');
        setTimeout(() => {
          setRefreshMessage('');
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to refresh feed:', error);
      setRefreshMessage('Error refreshing feed');
      setTimeout(() => {
        setRefreshMessage('');
      }, 3000);
    } finally {
      setRefreshingFeedId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading feeds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Realtime Feed</h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor clinical trial updates from ClinicalTrials.gov
            </p>
          </div>
          <div className="flex items-center gap-3">
            {refreshMessage && !refreshingFeedId && (
              <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-md">
                {refreshMessage}
              </span>
            )}
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Watch New Feed
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Watched Feeds */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <h2 className="font-semibold text-gray-900 mb-4">Watched Feeds</h2>
                {feeds.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">No feeds yet</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Click "Watch New Feed" to start
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedFeed(null);
                        loadUpdates();
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedFeed === null
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-sm">All Feeds</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {timeline.reduce((sum, t) => sum + t.updates.length, 0)} updates
                      </div>
                    </button>
                    {feeds.map((feed) => (
                      <div
                        key={feed.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          selectedFeed === feed.id
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedFeed(feed.id);
                            loadUpdates(feed.id);
                          }}
                          className="w-full text-left"
                        >
                          <div className="font-medium text-sm truncate">{feed.label}</div>
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {new URL(feed.feed_url).searchParams.get('intr') || 'Custom feed'}
                          </div>
                          {feed.last_checked_at && (
                            <div className="text-xs text-gray-400 mt-1">
                              Last checked: {new Date(feed.last_checked_at).toLocaleString()}
                            </div>
                          )}
                        </button>
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <button
                            onClick={() => handleRefreshFeed(feed.id)}
                            disabled={refreshingFeedId === feed.id}
                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${refreshingFeedId === feed.id ? 'animate-spin' : ''}`} />
                            {refreshingFeedId === feed.id ? 'Checking...' : 'Refresh'}
                          </button>
                          <button
                            onClick={() => handleEditFeed(feed)}
                            className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteFeed(feed.id)}
                            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        </div>
                        {refreshingFeedId === feed.id && refreshMessage && (
                          <div className="text-xs text-blue-600 mt-1">{refreshMessage}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Main Content - Timeline */}
            <div className="lg:col-span-3">
              {timeline.length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      No updates yet
                    </h2>
                    <p className="text-gray-600 max-w-md mx-auto">
                      {selectedFeed 
                        ? 'No updates found for this feed. Click "Refresh" to check for new updates.'
                        : 'Once you add RSS feeds to watch, updates will appear here. The system checks for new trial updates daily.'
                      }
                    </p>
                  </div>
                </Card>
              ) : (
                <div>
                  {/* Timeline Header */}
                  {selectedFeed && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-gray-900">
                          {feeds.find(f => f.id === selectedFeed)?.label || 'Feed Timeline'}
                        </h2>
                        <span className="text-sm text-gray-500">
                          {timeline.reduce((sum, t) => sum + t.updates.length, 0)} total updates
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Complete history since you started watching this feed
                      </p>
                    </div>
                  )}

                  {/* Vertical Timeline */}
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    <div className="space-y-8">
                      {timeline.map((day) => (
                        <div key={day.date} className="relative">
                          {/* Date marker on timeline */}
                          <div className="flex items-center gap-4 mb-4">
                            <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full">
                              <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {formatDate(day.date)}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {day.updates.length} update{day.updates.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* Updates for this date */}
                          <div className="ml-12 space-y-4">
                            {day.updates.map((update: TrialUpdate) => (
                              <Card 
                                key={update.id} 
                                className={`p-5 hover:shadow-lg transition-all border-l-4 ${
                                  update.raw_diff_blocks.includes('NEW_STUDY') 
                                    ? 'border-l-green-500' 
                                    : 'border-l-blue-500'
                                }`}
                              >
                                <div className="space-y-3">
                                  {/* Header with NCT ID and version/new badge */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <a
                                      href={update.study_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded hover:bg-blue-200 transition-colors"
                                    >
                                      {update.nct_id} →
                                    </a>
                                    {update.raw_diff_blocks.includes('NEW_STUDY') ? (
                                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded uppercase tracking-wide">
                                        ✨ New Study
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        Version {update.version_a} → {update.version_b}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">
                                      {new Date(update.last_update).toLocaleString()}
                                    </span>
                                  </div>

                                  {/* Study Title */}
                                  <h4 className="font-semibold text-gray-900 text-base leading-snug">
                                    <a
                                      href={update.study_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-blue-600 transition-colors"
                                    >
                                      {update.title}
                                    </a>
                                  </h4>

                                  {/* LLM Summary */}
                                  <div className={`border-l-4 p-3 rounded ${
                                    update.raw_diff_blocks.includes('NEW_STUDY')
                                      ? 'bg-green-50 border-green-400'
                                      : 'bg-amber-50 border-amber-400'
                                  }`}>
                                    <div className="flex items-start gap-2">
                                      <span className={`font-medium text-xs uppercase tracking-wide ${
                                        update.raw_diff_blocks.includes('NEW_STUDY')
                                          ? 'text-green-700'
                                          : 'text-amber-700'
                                      }`}>
                                        {update.raw_diff_blocks.includes('NEW_STUDY') ? 'Summary' : 'Changes'}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                                      {update.llm_summary}
                                    </p>
                                  </div>

                                  {/* Action Links */}
                                  <div className="flex items-center gap-4 pt-2">
                                    <a
                                      href={update.study_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      View Study
                                    </a>
                                    <a
                                      href={update.history_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Version History
                                    </a>
                                    {!update.raw_diff_blocks.includes('NEW_STUDY') && update.comparison_url && (
                                      <a
                                        href={update.comparison_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Compare Versions
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Feed Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Watch New Clinical Trials</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter a drug name, intervention, or condition to monitor for updates.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Term <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newSearchTerm}
                  onChange={(e) => setNewSearchTerm(e.target.value)}
                  placeholder="e.g., Orforglipron, Semaglutide, Type 2 Diabetes"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newSearchTerm.trim()) {
                      handleAddFeed();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will monitor trials in the USA with this intervention/condition
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Label (Optional)
                </label>
                <Input
                  value={newFeedLabel}
                  onChange={(e) => setNewFeedLabel(e.target.value)}
                  placeholder={`${newSearchTerm || 'Search term'} trials`}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>What we'll monitor:</strong>
                  <br />
                  • Trials with "{newSearchTerm || 'your search term'}" as intervention
                  <br />
                  • Location: USA
                  <br />
                  • Updates from the last 14 days
                  <br />• Daily checks for changes
                </p>
              </div>
              {validationError && (
                <div className={`text-xs p-2 rounded ${
                  validationError.startsWith('⚠️') 
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {validationError}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewSearchTerm('');
                    setNewFeedLabel('');
                    setValidationError('');
                  }}
                  variant="outline"
                  disabled={validatingFeed}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddFeed}
                  disabled={!newSearchTerm.trim() || validatingFeed}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {validatingFeed ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    'Start Watching'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Feed Modal */}
      {editingFeed && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Watched Feed</h2>
            <p className="text-sm text-gray-600 mb-4">
              Update the search term or label for this feed.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Term <span className="text-red-500">*</span>
                </label>
                <Input
                  value={editSearchTerm}
                  onChange={(e) => setEditSearchTerm(e.target.value)}
                  placeholder="e.g., Orforglipron, Semaglutide"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Changing this will update the RSS feed URL
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label
                </label>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder={`${editSearchTerm || 'Search term'} trials`}
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Changing the search term will create a new RSS feed URL.
                  Existing updates will remain in your timeline.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={handleCancelEdit} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editSearchTerm.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

