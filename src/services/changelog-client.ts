// Remove client-side import of server-only modules
// import { ScrapedData, ScrapedUpdate, convertScrapedToUpdate } from './changelog-scraper';

export interface Update {
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
  // Enhanced fields for real changelog complexity
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

export class ChangelogClient {
  private baseUrl = '/api/scrape';
  private dataUrl = '/api/data';
  private cache: Map<string, { data: Update[], timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async loadStoredData(): Promise<Update[]> {
    try {
      console.log('Loading stored historical data...');
      
      const response = await fetch(this.dataUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load stored data');
      }

      // Convert stored data to Update format
      const updates: Update[] = [];
      let idCounter = 1;

      if (Array.isArray(result.data)) {
        for (const storedData of result.data) {
          for (const scrapedUpdate of storedData.updates) {
            const update = this.convertScrapedToUpdate(scrapedUpdate, storedData.competitor, idCounter++);
            updates.push(update);
          }
        }
      }

      // Sort by timestamp (most recent first)
      updates.sort((a, b) => {
        const aTime = this.parseRelativeTime(a.timestamp);
        const bTime = this.parseRelativeTime(b.timestamp);
        return bTime - aTime;
      });

      console.log(`Successfully loaded ${updates.length} stored updates`);
      return updates;

    } catch (error) {
      console.error('Error loading stored data:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async fetchScrapedChangelogs(sources: string[] = ['stripe', 'vercel', 'supabase']): Promise<Update[]> {
    const cacheKey = sources.sort().join(',');
    const cached = this.cache.get(cacheKey);
    
    // Check if we have valid cached data
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('Using cached changelog data');
      return cached.data;
    }

    try {
      console.log('Fetching fresh changelog data for:', sources);
      
      const response = await fetch(`${this.baseUrl}?source=all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch changelog data');
      }

             // Convert scraped data to Update format
       const updates: Update[] = [];
       let idCounter = 1;

       if (Array.isArray(result.data)) {
         // Multiple sources
         for (const scrapedData of result.data) {
           for (const scrapedUpdate of scrapedData.updates) {
             const update = this.convertScrapedToUpdate(scrapedUpdate, scrapedData.competitor, idCounter++);
             updates.push(update);
           }
         }
       } else {
         // Single source
         const scrapedData = result.data;
         for (const scrapedUpdate of scrapedData.updates) {
           const update = this.convertScrapedToUpdate(scrapedUpdate, scrapedData.competitor, idCounter++);
           updates.push(update);
         }
       }

      // Sort by timestamp (most recent first)
      updates.sort((a, b) => {
        const aTime = this.parseRelativeTime(a.timestamp);
        const bTime = this.parseRelativeTime(b.timestamp);
        return bTime - aTime;
      });

      // Cache the results
      this.cache.set(cacheKey, {
        data: updates,
        timestamp: Date.now()
      });

      console.log(`Successfully fetched ${updates.length} changelog updates`);
      return updates;

    } catch (error) {
      console.error('Error fetching changelog data:', error);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log('Using expired cached data due to fetch error');
        return cached.data;
      }
      
      throw error;
    }
  }

  async refreshChangelogs(sources: string[] = ['stripe', 'openai']): Promise<Update[]> {
    // Clear cache for these sources
    const cacheKey = sources.sort().join(',');
    this.cache.delete(cacheKey);
    
    return this.fetchScrapedChangelogs(sources);
  }

  private parseRelativeTime(timeStr: string): number {
    const now = Date.now();
    
    if (timeStr.includes('just now') || timeStr.includes('recently')) {
      return now;
    }
    
    const hoursMatch = timeStr.match(/(\d+)\s*hours?\s*ago/);
    if (hoursMatch) {
      return now - (parseInt(hoursMatch[1]) * 60 * 60 * 1000);
    }
    
    const daysMatch = timeStr.match(/(\d+)\s*days?\s*ago/);
    if (daysMatch) {
      return now - (parseInt(daysMatch[1]) * 24 * 60 * 60 * 1000);
    }
    
    // Try to parse as a date
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    
    return now;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStatus(): { [key: string]: { age: number, count: number } } {
    const status: { [key: string]: { age: number, count: number } } = {};
    
    for (const [key, cached] of this.cache.entries()) {
      status[key] = {
        age: Date.now() - cached.timestamp,
        count: cached.data.length
      };
    }
    
    return status;
  }

  private convertScrapedToUpdate(scraped: any, competitor: string, id: number): Update {
    // Convert relative timestamps
    const getRelativeTime = (dateStr: string): string => {
      const now = new Date();
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) {
        return 'Just now';
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    };

    // Determine impact based on content and type
    const getImpact = (title: string, description: string, type: string): 'high' | 'medium' | 'low' => {
      const content = (title + ' ' + description).toLowerCase();
      
      // High impact indicators
      if (type === 'breaking' || type === 'security' || 
          content.includes('major') || content.includes('breaking') || 
          content.includes('launch') || content.includes('new api') || 
          content.includes('deprecat') || content.includes('security') ||
          content.includes('vulnerability') || content.includes('critical')) {
        return 'high';
      } 
      
      // Medium impact indicators
      if (type === 'feature' || type === 'performance' ||
          content.includes('new') || content.includes('improv') || 
          content.includes('enhanc') || content.includes('updat') ||
          content.includes('added') || content.includes('support')) {
        return 'medium';
      } 
      
      // Low impact (bugfix, minor improvements)
      return 'low';
    };

    // Generate realistic changes based on the update with improved parsing
    const generateChanges = (scraped: any) => {
      const changes = {
        added: [] as string[],
        modified: [] as string[],
        removed: [] as string[]
      };

      // Enhanced change generation based on real data patterns
      const description = scraped.description || '';
      const content = (scraped.title + ' ' + description).toLowerCase();
      
      // Parse added features from description
      if (content.includes('adds ') || content.includes('new ') || content.includes('launch') || content.includes('introduce')) {
        if (scraped.type === 'feature' || scraped.type === 'improvement') {
          changes.added.push(scraped.title);
          
          // Extract specific additions from description
          const addedItems = description.match(/adds?\s+([^.]+)/gi);
          if (addedItems) {
            addedItems.slice(0, 3).forEach((item: string) => {
              const cleanItem = item.replace(/adds?\s+/i, '').trim();
              if (cleanItem.length > 10 && cleanItem.length < 80) {
                changes.added.push(cleanItem);
              }
            });
          }
        }
      }
      
      // Parse modifications from description
      if (content.includes('updat') || content.includes('improv') || content.includes('enhanc') || content.includes('modif')) {
        changes.modified.push(scraped.title);
        
        // Extract specific modifications
        const modifiedItems = description.match(/(updat|improv|enhanc|modif)[^.]+/gi);
        if (modifiedItems) {
          modifiedItems.slice(0, 2).forEach((item: string) => {
            const cleanItem = item.trim();
            if (cleanItem.length > 10 && cleanItem.length < 80) {
              changes.modified.push(cleanItem);
            }
          });
        }
      }
      
      // Parse removals from description
      if (content.includes('remov') || content.includes('deprecat') || content.includes('discontinu')) {
        const removedItems = description.match(/(remov|deprecat|discontinu)[^.]+/gi);
        if (removedItems) {
          removedItems.slice(0, 2).forEach((item: string) => {
            const cleanItem = item.trim();
            if (cleanItem.length > 10 && cleanItem.length < 80) {
              changes.removed.push(cleanItem);
            }
          });
        }
      }
      
      // Fallback based on type if no specific changes found
      if (changes.added.length === 0 && changes.modified.length === 0 && changes.removed.length === 0) {
        if (scraped.type === 'feature') {
          changes.added.push(scraped.title);
        } else if (scraped.type === 'improvement' || scraped.type === 'performance') {
          changes.modified.push(scraped.title);
        } else if (scraped.type === 'bugfix') {
          changes.modified.push(`Fixed: ${scraped.title}`);
        } else if (scraped.type === 'breaking') {
          changes.modified.push(`Breaking: ${scraped.title}`);
          changes.removed.push('Legacy compatibility');
        }
      }

      return changes;
    };

    return {
      id,
      competitor,
      title: scraped.title,
      type: scraped.type,
      timestamp: getRelativeTime(scraped.date),
      impact: getImpact(scraped.title, scraped.description, scraped.type),
      changes: generateChanges(scraped),
      screenshot: `data:image/svg+xml;base64,${btoa(`<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f9ff"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#374149" text-anchor="middle" dy=".3em">${scraped.title}</text></svg>`)}`,
      // Enhanced fields
      version: scraped.version,
      tags: scraped.tags,
      description: scraped.description,
      confidence: scraped.confidence,
      metadata: {
        sourceUrl: scraped.url,
        scrapedAt: new Date().toISOString(),
        affectedServices: scraped.metadata?.affectedServices || []
      }
    };
  }
}

// Export a singleton instance
export const changelogClient = new ChangelogClient(); 