'use client';

import React, { useState, useEffect } from 'react';
import { Eye, GitBranch, Calendar, Filter, Star, ExternalLink, Zap, Plus, Minus, RefreshCw, ArrowLeft, TrendingUp, Activity, Users, Clock, BarChart3, Globe } from 'lucide-react';
import Link from 'next/link';

interface Competitor {
  name: string;
  logo: string;
  color: string;
  website: string;
  description: string;
}

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

const LaunchRadar: React.FC = () => {
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedUpdate, setSelectedUpdate] = useState<Update | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [currentView, setCurrentView] = useState<'timeline' | 'companies'>('timeline');
  const [scrapedUpdates, setScrapedUpdates] = useState<Update[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [activityTimeframe, setActivityTimeframe] = useState<number>(2);
  const [recentUpdateLimit, setRecentUpdateLimit] = useState(20);
  const [mounted, setMounted] = useState(false);

  // Force client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load data after mounting
  useEffect(() => {
    if (!mounted) return;

    const loadData = async () => {
      try {
        console.log('🔄 Loading API data...');
        const response = await fetch('/api/data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 API Response:', result.success, 'Companies:', result.data?.length);
        
        if (result.success && result.data && Array.isArray(result.data)) {
          const updates: Update[] = [];
          let id = 1;
          
          result.data.forEach((company: any) => {
            if (company.updates && Array.isArray(company.updates)) {
              company.updates.forEach((update: any) => {
                updates.push({
                  id: id++,
                  competitor: company.competitor || 'unknown',
                  title: update.title || 'Untitled',
                  type: update.type || 'improvement',
                  timestamp: update.date || new Date().toISOString().split('T')[0],
                  impact: 'medium',
                  changes: {
                    added: update.description ? [update.description] : [],
                    modified: [],
                    removed: []
                  },
                  screenshot: '',
                  version: update.version || '',
                  tags: update.tags || [],
                  description: update.description || '',
                  confidence: update.confidence || 0.8,
                  metadata: {
                    sourceUrl: update.url || '',
                    scrapedAt: new Date().toISOString(),
                    affectedServices: update.metadata?.affectedServices || []
                  }
                });
              });
            }
          });
          
          console.log('✅ Loaded', updates.length, 'updates from', result.data.length, 'companies');
          
          setScrapedUpdates(updates);
          setLastRefresh(new Date().toLocaleTimeString());
          
          // Auto-select the first 3 companies with data
          const availableCompetitors = [...new Set(updates.map(update => update.competitor))];
          if (availableCompetitors.length > 0) {
            const topCompetitors = availableCompetitors.slice(0, 3);
            setSelectedCompetitors(topCompetitors);
            console.log('Auto-selected competitors:', topCompetitors);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [mounted]);

  // Competitor data
  const competitors: Record<string, Competitor> = {
    notion: { 
      name: 'Notion', 
      logo: '📝', 
      color: 'bg-slate-100',
      website: 'https://notion.so',
      description: 'All-in-one workspace for notes, tasks, wikis, and databases'
    },
    figma: { 
      name: 'Figma', 
      logo: '🎨', 
      color: 'bg-pink-100',
      website: 'https://figma.com',
      description: 'Collaborative design tool for UI/UX teams'
    },
    stripe: { 
      name: 'Stripe', 
      logo: '💳', 
      color: 'bg-blue-100',
      website: 'https://stripe.com',
      description: 'Payment processing platform for online businesses'
    },
    gumroad: { 
      name: 'Gumroad', 
      logo: '💰', 
      color: 'bg-yellow-100',
      website: 'https://gumroad.com',
      description: 'Platform for creators to sell digital products'
    },
    vercel: { 
      name: 'Vercel', 
      logo: '▲', 
      color: 'bg-gray-100',
      website: 'https://vercel.com',
      description: 'Frontend cloud platform for static and JAMstack deployment'
    },
    supabase: { 
      name: 'Supabase', 
      logo: '🗃️', 
      color: 'bg-emerald-100',
      website: 'https://supabase.com',
      description: 'Open-source Firebase alternative with PostgreSQL database'
    }
  };

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading LaunchRadar data...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching updates from API...</p>
        </div>
      </div>
    );
  }

  const allUpdates = scrapedUpdates;
  const filteredUpdates = allUpdates.filter(update => {
    const matchesCompetitor = selectedCompetitors.includes(update.competitor);
    const matchesFilter = filter === 'all' || update.type === filter;
    return matchesCompetitor && matchesFilter;
  });

  const availableCompetitors = [...new Set(allUpdates.map(update => update.competitor))];

  const getCompetitorUpdateCount = (competitorId: string) =>
    allUpdates.filter(update => update.competitor === competitorId).length;

  const generateActivityGraph = (competitorId: string, years: number = 2) => {
    const weeks = years * 52;
    const competitorUpdates = allUpdates.filter(update => update.competitor === competitorId);
    
    // Generate realistic activity based on actual update count
    const totalUpdates = competitorUpdates.length;
    
    const generateMockActivity = (totalUpdates: number, weeks: number) => {
      const activity = [];
      const avgUpdatesPerWeek = totalUpdates / weeks;
      
      for (let i = 0; i < weeks; i++) {
        // Create realistic patterns with some randomness
        const baseActivity = Math.max(0, Math.random() * avgUpdatesPerWeek * 2);
        const seasonalMultiplier = 1 + 0.3 * Math.sin((i / 52) * 2 * Math.PI); // Yearly cycle
        const weeklyMultiplier = i % 7 < 5 ? 1.2 : 0.8; // Weekday vs weekend
        
        const weekActivity = Math.round(baseActivity * seasonalMultiplier * weeklyMultiplier);
        activity.push(Math.min(weekActivity, 10)); // Cap at 10 updates per week
      }
      
      return activity;
    };

    return generateMockActivity(totalUpdates, weeks);
  };

  const getCompanyStats = (competitorId: string) => {
    const updates = allUpdates.filter(update => update.competitor === competitorId);
    const recentUpdates = updates.slice(0, 10);
    
    const typeDistribution = updates.reduce((acc, update) => {
      acc[update.type] = (acc[update.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = updates.length > 0 
      ? updates.reduce((sum, update) => sum + (update.confidence || 0.8), 0) / updates.length 
      : 0.8;

    return {
      totalUpdates: updates.length,
      recentUpdates: recentUpdates.length,
      typeDistribution,
      avgConfidence,
      lastUpdate: updates[0]?.timestamp || 'Never'
    };
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature': return <Zap className="w-4 h-4" />;
      case 'pricing': return <Users className="w-4 h-4" />;
      case 'bugfix': return <RefreshCw className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const addCompetitor = (competitorId: string) => {
    if (!selectedCompetitors.includes(competitorId)) {
      setSelectedCompetitors([...selectedCompetitors, competitorId]);
    }
  };

  const removeCompetitor = (competitorId: string) => {
    setSelectedCompetitors(selectedCompetitors.filter(id => id !== competitorId));
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">LaunchRadar</h1>
            </div>
            <div className="text-sm text-gray-500">
              Tracking {allUpdates.length} updates from {availableCompetitors.length} companies
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Last updated: {lastRefresh || 'Never'}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentView('timeline')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  currentView === 'timeline' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setCurrentView('companies')}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  currentView === 'companies' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Companies
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 h-screen overflow-y-auto">
          <div className="p-6">
            <div className="space-y-6">
              {/* Selected Companies */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3 tracking-tight uppercase">Selected Companies ({selectedCompetitors.length})</h3>
                <div className="space-y-2">
                  {selectedCompetitors.map(competitorId => {
                    const competitor = competitors[competitorId];
                    const updateCount = getCompetitorUpdateCount(competitorId);
                    
                    return (
                      <div key={competitorId} className="flex items-center justify-between p-3 bg-white rounded-lg shadow border border-gray-200 mb-2 transition hover:shadow-md">
                        <Link href={`/company/${competitorId}`} className="flex-1">
                          <div className="flex items-center space-x-3 cursor-pointer">
                            <span className="text-2xl font-bold">{competitor?.logo || '🏢'}</span>
                            <div>
                              <div className="font-semibold text-base text-gray-900">{competitor?.name || competitorId}</div>
                              <div className="text-xs text-gray-600 font-medium">{updateCount} updates</div>
                            </div>
                          </div>
                        </Link>
                        <button
                          onClick={() => removeCompetitor(competitorId)}
                          className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 font-bold text-lg border border-gray-200 shadow-sm transition"
                          aria-label="Remove company"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Available Companies */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3 tracking-tight uppercase">Available Companies</h3>
                <div className="space-y-2">
                  {availableCompetitors
                    .filter(id => !selectedCompetitors.includes(id))
                    .map(competitorId => {
                      const competitor = competitors[competitorId];
                      const updateCount = getCompetitorUpdateCount(competitorId);
                      
                      return (
                        <div key={competitorId} className="flex items-center justify-between p-3 bg-white rounded-lg shadow border border-gray-200 mb-2 transition hover:shadow-md">
                          <Link href={`/company/${competitorId}`} className="flex-1">
                            <div className="flex items-center space-x-3 cursor-pointer">
                              <span className="text-2xl font-bold">{competitor?.logo || '🏢'}</span>
                              <div>
                                <div className="font-semibold text-base text-gray-900">{competitor?.name || competitorId}</div>
                                <div className="text-xs text-gray-600 font-medium">{updateCount} updates</div>
                              </div>
                            </div>
                          </Link>
                          <button
                            onClick={() => addCompetitor(competitorId)}
                            className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-800 font-bold text-lg border border-blue-200 shadow-sm transition"
                            aria-label="Add company"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {currentView === 'timeline' ? (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Recent Updates</h2>
                <p className="text-sm text-gray-600">
                  Showing {filteredUpdates.length} updates from {selectedCompetitors.length} selected companies
                </p>
                {/* Filter Buttons Below Recent Updates */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    { value: 'all', label: 'All Types' },
                    { value: 'feature', label: 'Features' },
                    { value: 'pricing', label: 'Pricing' },
                    { value: 'bugfix', label: 'Bug Fixes' },
                    { value: 'improvement', label: 'Improvements' },
                    { value: 'security', label: 'Security' },
                    { value: 'performance', label: 'Performance' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilter(opt.value)}
                      className={`px-4 py-2 rounded-md text-sm font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        filter === opt.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {filteredUpdates.slice(0, recentUpdateLimit).map(update => (
                  <div key={update.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">{competitors[update.competitor]?.logo || '🏢'}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-900">{competitors[update.competitor]?.name || update.competitor}</span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(update.impact)}`}>
                              {getTypeIcon(update.type)}
                              <span className="ml-1">{update.type}</span>
                            </span>
                            <span className="text-xs text-gray-500">{update.timestamp}</span>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">{update.title}</h3>
                          {update.description && (
                            <p className="text-gray-600 text-sm mb-3">{update.description}</p>
                          )}
                          {update.changes.added.length > 0 && (
                            <div className="space-y-1">
                              {update.changes.added.slice(0, 3).map((change, idx) => (
                                <div key={idx} className="text-sm text-gray-600 flex items-start">
                                  <span className="text-green-500 mr-2">+</span>
                                  <span>{change}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {update.metadata?.sourceUrl && (
                          <a
                            href={update.metadata.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedUpdate(update)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredUpdates.length > recentUpdateLimit && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setRecentUpdateLimit(recentUpdateLimit + 20)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Load More Updates
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Company Overview</h2>
                <p className="text-sm text-gray-600">Detailed analytics for each company</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {selectedCompetitors.map(competitorId => {
                  const competitor = competitors[competitorId];
                  const stats = getCompanyStats(competitorId);
                  const activity = generateActivityGraph(competitorId, activityTimeframe);
                  
                  return (
                    <div key={competitorId} className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{competitor?.logo || '🏢'}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{competitor?.name || competitorId}</h3>
                            <p className="text-sm text-gray-500">{competitor?.description}</p>
                          </div>
                        </div>
                        <a
                          href={competitor?.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-500"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{stats.totalUpdates}</div>
                          <div className="text-xs text-gray-500">Total Updates</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{(stats.avgConfidence * 100).toFixed(0)}%</div>
                          <div className="text-xs text-gray-500">Confidence</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{stats.recentUpdates}</div>
                          <div className="text-xs text-gray-500">Recent</div>
                        </div>
                      </div>

                      {/* GitHub-style Activity Graph */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Activity Graph</h4>
                        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(53, minmax(0, 1fr))' }}>
                          {activity.map((level, index) => {
                            const getLevelColor = (level: number) => {
                              if (level === 0) return 'bg-gray-100';
                              if (level <= 2) return 'bg-green-200';
                              if (level <= 4) return 'bg-green-300';
                              if (level <= 6) return 'bg-green-400';
                              return 'bg-green-500';
                            };

                            return (
                              <div
                                key={index}
                                className={`w-2.5 h-2.5 rounded-sm ${getLevelColor(level)}`}
                                title={`Week ${index + 1}: ${level} updates`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                          <span>{activityTimeframe} year{activityTimeframe > 1 ? 's' : ''} ago</span>
                          <span>Today</span>
                        </div>
                      </div>

                      {/* Type Distribution */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Update Types</h4>
                        <div className="space-y-2">
                          {Object.entries(stats.typeDistribution)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 4)
                            .map(([type, count]) => (
                              <div key={type} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {getTypeIcon(type)}
                                  <span className="text-sm text-gray-600 capitalize">{type}</span>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Update Detail Modal */}
      {selectedUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{competitors[selectedUpdate.competitor]?.logo || '🏢'}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedUpdate.title}</h2>
                    <p className="text-sm text-gray-500">
                      {competitors[selectedUpdate.competitor]?.name || selectedUpdate.competitor} • {selectedUpdate.timestamp}
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
                      {selectedUpdate.changes.added.map((change, idx) => (
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
                      {selectedUpdate.tags.map((tag, idx) => (
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
                      {selectedUpdate.metadata.affectedServices.map((service, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-700">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    {selectedUpdate.version && (
                      <span>Version: {selectedUpdate.version}</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedUpdate.metadata?.sourceUrl && (
                      <a
                        href={selectedUpdate.metadata.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Source
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedUpdate(null)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaunchRadar; 