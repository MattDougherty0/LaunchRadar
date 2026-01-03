'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Update {
  id: number;
  competitor: string;
  title: string;
  type: 'feature' | 'pricing' | 'bugfix' | 'improvement' | 'breaking' | 'security' | 'performance';
  timestamp: string;
  impact: 'high' | 'medium' | 'low';
  changes: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  screenshot: string;
  version?: string;
  tags?: string[];
  description?: string;
  confidence?: number;
  metadata?: {
    sourceUrl?: string;
    scrapedAt?: string;
    affectedServices?: string[];
  };
}

interface CompanyPageProps {
  companyId: string;
}

export default function CompanyPage({ companyId }: { companyId: string }) {
  const [company, setCompany] = React.useState<any>(null);
  const [updates, setUpdates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activityTimeframe, setActivityTimeframe] = React.useState(1); // 1 year default
  const [selectedUpdate, setSelectedUpdate] = React.useState<any | null>(null);
  const [updateFilter, setUpdateFilter] = useState('all'); // New state for update filters

  const competitors: Record<string, { name: string; logo: string; website: string; description: string }> = {
    notion: {
      name: 'Notion',
      logo: '📝',
      website: 'https://notion.so',
      description: 'All-in-one workspace for notes, tasks, wikis, and databases',
    },
    figma: {
      name: 'Figma',
      logo: '🎨',
      website: 'https://figma.com',
      description: 'Collaborative design tool for UI/UX teams',
    },
    stripe: {
      name: 'Stripe',
      logo: '💳',
      website: 'https://stripe.com',
      description: 'Payment processing platform for online businesses',
    },
    gumroad: {
      name: 'Gumroad',
      logo: '💰',
      website: 'https://gumroad.com',
      description: 'Platform for creators to sell digital products',
    },
    vercel: {
      name: 'Vercel',
      logo: '▲',
      website: 'https://vercel.com',
      description: 'Frontend cloud platform for static and JAMstack deployment',
    },
    supabase: {
      name: 'Supabase',
      logo: '🗃️',
      website: 'https://supabase.com',
      description: 'Open-source Firebase alternative with PostgreSQL database',
    },
    caldotcom: {
      name: 'Cal.com',
      logo: '📅',
      website: 'https://cal.com',
      description: 'Open scheduling infrastructure for everyone',
    },
    carrd: {
      name: 'Carrd',
      logo: '🌐',
      website: 'https://carrd.co',
      description: 'Simple, free, fully responsive one-page sites for pretty much anything',
    },
    convertkit: {
      name: 'ConvertKit',
      logo: '✉️',
      website: 'https://convertkit.com',
      description: 'Email marketing for creators',
    },
  };

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/data')
      .then((res) => res.json())
      .then((data) => {
        // The API returns { success: true, data: [ ...companies ] }
        const found = data.data.find((c: any) => c.competitor === companyId);
        if (!found) {
          setError('Company Not Found');
        } else {
          setCompany(found);
          // Normalize updates to ensure a valid timestamp field
          const normalized = (found.updates || []).map((u: any, index: number) => {
            const d = parseUpdateDate(u);
            return {
              ...u,
              id: u.id ?? index + 1,
              timestamp: u.timestamp || (d ? d.toISOString().split('T')[0] : ''),
            };
          });
          setUpdates(normalized);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load company data');
        setLoading(false);
      });
  }, [companyId]);

  const generateActivityGraph = (years: number = 1) => {
    const weeks = years * 52;
    const activity: number[] = [];
    
    // Generate mock activity based on update count
    const totalUpdates = updates.length;
    const avgUpdatesPerWeek = totalUpdates / weeks;
    
    for (let i = 0; i < weeks; i++) {
      // Add some randomness to make it look realistic
      const baseActivity = avgUpdatesPerWeek * (0.5 + Math.random());
      const activityLevel = Math.floor(baseActivity);
      activity.push(Math.min(activityLevel, 7)); // Cap at 7 for color scale
    }
    
    return activity;
  };

  const getTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      feature: '✨',
      pricing: '💰',
      bugfix: '🐛',
      improvement: '⚡',
      breaking: '💥',
      security: '🔒',
      performance: '🚀'
    };
    return icons[type] || '📝';
  };

  const getImpactColor = (impact: string) => {
    const colors: { [key: string]: string } = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[impact] || 'bg-gray-100 text-gray-800';
  };

  const getLevelColor = (level: number) => {
    if (level === 0) return 'bg-gray-100';
    if (level <= 2) return 'bg-green-200';
    if (level <= 4) return 'bg-green-300';
    if (level <= 6) return 'bg-green-400';
    return 'bg-green-500';
  };

  const activity = generateActivityGraph(activityTimeframe);

  // Helper to get start date for the graph
  const getStartDate = (years: number) => {
    const now = new Date();
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - years);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  // Helper to get date string (YYYY-MM-DD), robust to invalid dates
  const formatDate = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Helper to parse an update's date, considering multiple possible fields
  const parseUpdateDate = (u: any): Date | null => {
    const dateRegex = /^\w+ \d{1,2}, \d{4}$/;

    let raw;
    if (u.description && dateRegex.test(u.description.trim())) {
      raw = u.description.trim();
    } else {
      raw = u.timestamp || u.date || u.updated || u.time || null;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;

    if (u.description) {
      const d2 = new Date(u.description);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  };

  // Add after formatDate
  const formatHumanDate = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts; // Fallback
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Build activity grid: 7 rows (Sun-Sat) × N weeks. Each cell accumulates daily update counts.
  const buildDailyActivityGrid = (updates: any[], years: number) => {
    const startDate = getStartDate(years);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const totalMs = now.getTime() - startDate.getTime();
    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const weeks = Math.ceil(totalDays / 7);
    const grid: number[][] = Array.from({ length: weeks }, () => Array(7).fill(0));

    // Aggregate updates by date string ➟ count
    const countByDate: Record<string, number> = {};
    updates.forEach((u) => {
      const d = parseUpdateDate(u);
      if (!d) return;
      const key = formatDate(d);
      countByDate[key] = (countByDate[key] || 0) + 1;
    });

    // Place each counted day in the proper week / weekday cell
    Object.entries(countByDate).forEach(([dateStr, count]) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      if (d < startDate || d > now) return;
      const diffDays = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.floor(diffDays / 7);
      const dayIdx = d.getDay();
      if (weekIdx >= 0 && weekIdx < weeks) {
        grid[weekIdx][dayIdx] += count;
      }
    });

    return grid;
  };

  // Color scale inspired by GitHub (4 levels) – tweakable
  const getGithubColor = (count: number) => {
    if (count === 0) return 'bg-gray-200';
    if (count === 1) return 'bg-green-200';
    if (count <= 4) return 'bg-green-300';
    if (count <= 9) return 'bg-green-400';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading company data...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Company Not Found</h1>
          <p className="text-gray-600 mb-4">The company "{companyId}" could not be found.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to LaunchRadar
          </Link>
        </div>
      </div>
    );
  }

  const filteredUpdates = updateFilter === 'all' ? updates : updates.filter((u: any) => (u.type || u.category || 'other') === updateFilter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{competitors[companyId]?.logo || company.logo || '🏢'}</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{competitors[companyId]?.name || company.name || company.competitor}</h1>
                  <p className="text-gray-600">{competitors[companyId]?.description || company.description}</p>
                </div>
              </div>
            </div>
            <a
              href={competitors[companyId]?.website || company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Recent Updates */}
          <div className="lg:col-span-2">
            {/* Filters - center, pill style, more spacing */}
            <div className="mb-6 flex flex-wrap justify-center gap-3">
              {['all', 'feature', 'fix', 'chore', 'security', 'performance', 'docs', 'other'].map((filter: string) => (
                <button
                  key={filter}
                  className={`px-4 py-1.5 rounded-full border text-sm font-semibold transition-colors duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${updateFilter === filter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'}`}
                  onClick={() => setUpdateFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-200">
              
              <div className="divide-y divide-gray-200">
                {filteredUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedUpdate(update)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(update.impact)}`}>
                            {getTypeIcon(update.type)}
                            <span className="ml-1 capitalize">{update.type}</span>
                          </span>
                          <span className="text-sm text-gray-500">{formatHumanDate(update.timestamp)}</span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{update.title}</h3>
                        {update.description && (
                          <p className="text-gray-600 text-sm mb-3">{update.description}</p>
                        )}
                        {update.tags && update.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {update.tags.slice(0, 3).map((tag: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                                {tag}
                              </span>
                            ))}
                            {update.tags.length > 3 && (
                              <span className="text-xs text-gray-500">+{update.tags.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredUpdates.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  No updates found for this company.
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Activity Graph */}
          <div className="lg:col-span-1">
            {/* Company Info Card - Smaller and above activity graph */}
            {company && (
              <div className="mb-6 p-4 rounded-lg bg-white shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  {competitors[companyId]?.logo || company.logo ? (
                    <img src={competitors[companyId]?.logo || company.logo} alt={competitors[companyId]?.name || company.name || company.competitor + ' logo'} className="w-10 h-10 rounded-lg object-contain bg-gray-100 border" />
                  ) : (
                    <span className="text-2xl">{competitors[companyId]?.logo || company.logo || '🏢'}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{competitors[companyId]?.name || company.name || company.competitor}</h3>
                    {competitors[companyId]?.website || company.website ? (
                      <a href={competitors[companyId]?.website || company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm block truncate">{competitors[companyId]?.website || company.website.replace(/^https?:\/\//, '')}</a>
                    ) : null}
                  </div>
                </div>
                {competitors[companyId]?.description || company.description ? (
                  <p className="mt-2 text-gray-600 text-sm leading-relaxed line-clamp-2">{competitors[companyId]?.description || company.description}</p>
                ) : null}
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Graph</h3>
                
                {/* Timeframe Selector */}
                <div className="flex space-x-2 mb-4">
                  {[1, 2, 5].map((years) => (
                    <button
                      key={years}
                      onClick={() => setActivityTimeframe(years)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        activityTimeframe === years
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {years}y
                    </button>
                  ))}
                </div>

                {/* GitHub-style Contribution Grid (daily, 7xN) */}
                <div className="overflow-x-auto pb-2">
                  <div className="flex">
                    {/* 52 columns (weeks) */}
                    {(() => {
                      const grid = buildDailyActivityGrid(updates, activityTimeframe);
                      const weeks = grid.length;
                      // Render as columns (weeks), each with 7 rows (days)
                      return Array.from({ length: weeks }).map((_, weekIdx) => (
                        <div key={weekIdx} className="flex flex-col gap-1 mr-0.5">
                          {Array.from({ length: 7 }).map((_, dayIdx) => (
                            <div
                              key={dayIdx}
                              className={`w-3 h-3 rounded-sm ${getGithubColor(grid[weekIdx][dayIdx])} border border-gray-100 cursor-pointer`}
                              title={`Week ${weekIdx + 1}, ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayIdx]}: ${grid[weekIdx][dayIdx]} update${grid[weekIdx][dayIdx] !== 1 ? 's' : ''}`}
                            />
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{activityTimeframe}y ago</span>
                    <span>Today</span>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs text-gray-400">Less</span>
                    <div className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-100" />
                    <div className="w-3 h-3 rounded-sm bg-green-500 border border-gray-100" />
                    <span className="text-xs text-gray-400">More</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Updates</p>
                    <p className="text-lg font-semibold text-gray-900">{updates.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">This Period</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {(() => {
                        // Only count updates in the visible period
                        const start = getStartDate(activityTimeframe);
                        const end = new Date();
                        return updates.filter(u => {
                          const d = parseUpdateDate(u);
                          return d && d >= start && d <= end;
                        }).length;
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg per Week</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {(() => {
                        const start = getStartDate(activityTimeframe);
                        const end = new Date();
                        const count = updates.filter(u => {
                          const d = parseUpdateDate(u);
                          return d && d >= start && d <= end;
                        }).length;
                        return (count / (activityTimeframe * 52)).toFixed(1);
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Update Detail Modal */}
      {selectedUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{competitors[companyId]?.logo || company.logo || '🏢'}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedUpdate.title}</h2>
                    <p className="text-sm text-gray-500">
                      {competitors[companyId]?.name || company.name} • {formatHumanDate(selectedUpdate.timestamp)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUpdate(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getImpactColor(selectedUpdate.impact)}`}>
                    {getTypeIcon(selectedUpdate.type)}
                    <span className="ml-1 capitalize">{selectedUpdate.type}</span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Impact: <span className="capitalize font-medium">{selectedUpdate.impact}</span>
                  </span>
                  {selectedUpdate.confidence && (
                    <span className="text-sm text-gray-500">
                      Confidence: <span className="font-medium">{Math.round(selectedUpdate.confidence * 100)}%</span>
                    </span>
                  )}
                </div>

                {selectedUpdate.description && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{selectedUpdate.description}</p>
                  </div>
                )}

                {selectedUpdate.changes.added.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Changes</h3>
                    <div className="space-y-2">
                      {selectedUpdate.changes.added.map((change: any, idx: number) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <span className="text-green-500 mt-1">+</span>
                          <span className="text-gray-600">{change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUpdate.tags && selectedUpdate.tags.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedUpdate.tags.map((tag: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUpdate.metadata?.affectedServices && selectedUpdate.metadata.affectedServices.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Affected Services</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedUpdate.metadata.affectedServices.map((service: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-700">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    {selectedUpdate.metadata?.sourceUrl && (
                      <a
                        href={selectedUpdate.metadata.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Source →
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedUpdate(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 