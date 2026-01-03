'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Star, ExternalLink, TrendingUp, Activity, Users, Clock, BarChart3, Globe } from 'lucide-react';

interface Update {
  title: string;
  date: string;
  description: string;
  tags: string[];
  type: string;
  url: string;
  confidence: number;
}

interface Company {
  competitor: string;
  updates: Update[];
  lastScraped: string;
  success: boolean;
}

const LaunchRadarFinal: React.FC = () => {
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Company configurations
  const companyConfig: Record<string, { name: string; logo: string; color: string; description: string }> = {
    notion: { 
      name: 'Notion', 
      logo: '📝', 
      color: 'bg-slate-100 text-slate-800',
      description: 'All-in-one workspace'
    },
    figma: { 
      name: 'Figma', 
      logo: '🎨', 
      color: 'bg-pink-100 text-pink-800',
      description: 'Design platform'
    },
    stripe: { 
      name: 'Stripe', 
      logo: '💳', 
      color: 'bg-blue-100 text-blue-800',
      description: 'Payment infrastructure'
    },
    vercel: { 
      name: 'Vercel', 
      logo: '▲', 
      color: 'bg-black text-white',
      description: 'Frontend cloud'
    },
    supabase: { 
      name: 'Supabase', 
      logo: '🔋', 
      color: 'bg-green-100 text-green-800',
      description: 'Backend as a service'
    },
    gumroad: { 
      name: 'Gumroad', 
      logo: '🛒', 
      color: 'bg-purple-100 text-purple-800',
      description: 'Creator platform'
    }
  };

  // Force client-side rendering first
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load data only after mounting
  useEffect(() => {
    if (!mounted) return;

    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        const result = await response.json();
        
        if (result.success && result.data) {
          setData(result.data);
          // Auto-select companies with most updates
          const sortedCompanies = result.data
            .filter((company: Company) => company.updates?.length > 0)
            .sort((a: Company, b: Company) => (b.updates?.length || 0) - (a.updates?.length || 0))
            .slice(0, 3)
            .map((company: Company) => company.competitor);
          setSelectedCompanies(sortedCompanies);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700">Loading LaunchRadar...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching competitor updates</p>
        </div>
      </div>
    );
  }

  const filteredData = data.filter(company => 
    selectedCompanies.includes(company.competitor) && company.updates?.length > 0
  );

  const totalUpdates = filteredData.reduce((sum, company) => sum + (company.updates?.length || 0), 0);

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-4xl">🚀</span>
                LaunchRadar
              </h1>
              <p className="text-gray-600 mt-1">Track competitor product updates in real-time</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{totalUpdates}</div>
              <div className="text-sm text-gray-500">Total Updates</div>
            </div>
          </div>
        </div>
      </div>

      {/* Company Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Select Companies to Track
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {data.map((company) => {
              const config = companyConfig[company.competitor] || { 
                name: company.competitor, 
                logo: '🏢', 
                color: 'bg-gray-100 text-gray-800',
                description: 'Company'
              };
              const isSelected = selectedCompanies.includes(company.competitor);
              const updateCount = company.updates?.length || 0;
              
              return (
                <button
                  key={company.competitor}
                  onClick={() => toggleCompany(company.competitor)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">{config.logo}</div>
                    <div className="font-medium text-gray-900">{config.name}</div>
                    <div className="text-sm text-gray-500">{updateCount} updates</div>
                    <div className={`inline-block px-2 py-1 rounded text-xs mt-2 ${config.color}`}>
                      {config.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Updates Feed */}
        <div className="space-y-6">
          {filteredData.map((company) => {
            const config = companyConfig[company.competitor] || { 
              name: company.competitor, 
              logo: '🏢', 
              color: 'bg-gray-100 text-gray-800',
              description: 'Company'
            };
            
            return (
              <div key={company.competitor} className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.logo}</span>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{config.name}</h3>
                        <p className="text-sm text-gray-500">{company.updates?.length || 0} recent updates</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm ${config.color}`}>
                      {config.description}
                    </div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {company.updates?.slice(0, 10).map((update, index) => (
                    <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-2 leading-6">
                            {update.title}
                          </h4>
                          {update.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                              {update.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {update.date}
                            </span>
                            {update.type && (
                              <span className={`px-2 py-1 rounded text-xs ${
                                update.type === 'feature' ? 'bg-green-100 text-green-800' :
                                update.type === 'improvement' ? 'bg-blue-100 text-blue-800' :
                                update.type === 'bugfix' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {update.type}
                              </span>
                            )}
                            {update.confidence && (
                              <span className="text-xs text-gray-400">
                                {Math.round(update.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                          {update.tags && update.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {update.tags.slice(0, 5).map((tag, tagIndex) => (
                                <span 
                                  key={tagIndex}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {update.url && (
                          <a
                            href={update.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filteredData.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Updates to Display</h3>
            <p className="text-gray-600">Select companies above to see their latest updates</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaunchRadarFinal; 