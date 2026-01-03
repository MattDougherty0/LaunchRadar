'use client';

import React, { useState, useEffect } from 'react';
import { Eye, GitBranch, Calendar, Filter, Star, ExternalLink, Zap, Plus, Minus, RefreshCw, ArrowLeft, TrendingUp, Activity, Users, Clock, BarChart3, Globe } from 'lucide-react';

interface ScrapedUpdate {
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

interface Competitor {
  name: string;
  logo: string;
  color: string;
  website: string;
  description: string;
}

const WorkingLaunchRadar: React.FC = () => {
  const [updates, setUpdates] = useState<ScrapedUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);

  // Debug: Test client-side JavaScript execution
  console.log('🚀 WorkingLaunchRadar component rendered at:', new Date().toISOString());
  console.log('🔍 Current state - loading:', loading, 'updates:', updates.length, 'error:', error);

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
      description: 'Payment processing platform for businesses'
    },
    vercel: { 
      name: 'Vercel', 
      logo: '▲', 
      color: 'bg-black text-white',
      website: 'https://vercel.com',
      description: 'Platform for frontend frameworks and static sites'
    },
    supabase: { 
      name: 'Supabase', 
      logo: '🔋', 
      color: 'bg-green-100',
      website: 'https://supabase.io',
      description: 'Open source Firebase alternative'
    },
    gumroad: { 
      name: 'Gumroad', 
      logo: '🛒', 
      color: 'bg-purple-100',
      website: 'https://gumroad.com',
      description: 'Platform for creators to sell digital products'
    }
  };

  // Load data from API
  useEffect(() => {
    console.log('🎯 useEffect triggered! This means client-side JavaScript is working');
    
    const loadData = async () => {
      try {
        console.log('🔄 Loading data from API...');
        const response = await fetch('/api/data');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📊 API Response:', result);
        
        if (result.success && result.data && Array.isArray(result.data)) {
          const allUpdates: ScrapedUpdate[] = [];
          let id = 1;
          
          result.data.forEach((company: any) => {
            if (company.updates && Array.isArray(company.updates)) {
              company.updates.forEach((update: any) => {
                allUpdates.push({
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
          
          console.log('✅ Loaded', allUpdates.length, 'updates');
          setUpdates(allUpdates);
          
          // Auto-select companies with data
          const availableCompanies = [...new Set(allUpdates.map(u => u.competitor))];
          setSelectedCompetitors(availableCompanies.slice(0, 3));
          
        } else {
          throw new Error('Invalid API response');
        }
      } catch (err) {
        console.error('❌ Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        console.log('🏁 Setting loading to false');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log('📊 State updated - loading:', loading, 'updates count:', updates.length, 'selected:', selectedCompetitors);
  }, [loading, updates, selectedCompetitors]);

  // Filter updates by selected competitors
  const filteredUpdates = updates.filter(update => 
    selectedCompetitors.includes(update.competitor)
  );

  console.log('🎨 Rendering with state:', { loading, updatesCount: updates.length, filteredCount: filteredUpdates.length });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading LaunchRadar data...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching updates from API...</p>
          <p className="text-xs text-gray-400 mt-1">Debug: Check browser console for logs</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">LaunchRadar</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {updates.length} total updates • {filteredUpdates.length} shown
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar - Company Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Companies</h2>
              <div className="space-y-3">
                {Object.entries(competitors).map(([id, competitor]) => {
                  const updateCount = updates.filter(u => u.competitor === id).length;
                  const isSelected = selectedCompetitors.includes(id);
                  
                  if (updateCount === 0) return null;
                  
                  return (
                    <div 
                      key={id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCompetitors(prev => prev.filter(c => c !== id));
                        } else {
                          setSelectedCompetitors(prev => [...prev, id]);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-lg ${competitor.color} flex items-center justify-center text-sm font-medium`}>
                            {competitor.logo}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{competitor.name}</div>
                            <div className="text-xs text-gray-500">{updateCount} updates</div>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content - Updates List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Updates</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Showing {filteredUpdates.length} updates from {selectedCompetitors.length} companies
                </p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {filteredUpdates.slice(0, 20).map((update) => (
                  <div key={update.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`w-6 h-6 rounded ${competitors[update.competitor]?.color || 'bg-gray-100'} flex items-center justify-center text-xs`}>
                            {competitors[update.competitor]?.logo || '?'}
                          </div>
                          <span className="font-medium text-gray-900">{competitors[update.competitor]?.name || update.competitor}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-sm text-gray-500">{update.timestamp}</span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{update.title}</h3>
                        {update.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{update.description}</p>
                        )}
                        <div className="flex items-center space-x-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            update.type === 'feature' ? 'bg-green-100 text-green-800' :
                            update.type === 'improvement' ? 'bg-blue-100 text-blue-800' :
                            update.type === 'bugfix' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {update.type}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            update.impact === 'high' ? 'bg-red-100 text-red-800' :
                            update.impact === 'medium' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {update.impact} impact
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <a
                          href={update.metadata?.sourceUrl || competitors[update.competitor]?.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredUpdates.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-gray-400 text-6xl mb-4">📭</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No updates found</h3>
                  <p className="text-gray-500">Select some companies to see their updates</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingLaunchRadar; 