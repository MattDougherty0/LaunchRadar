import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapedUpdate {
  title: string;
  date: string;
  type: 'feature' | 'pricing' | 'bugfix' | 'improvement' | 'breaking' | 'security' | 'performance';
  description: string;
  category?: string;
  url?: string;
  // Enhanced fields for real changelog complexity
  version?: string;
  tags?: string[];
  rawContent?: string;
  confidence?: number; // How confident we are in the extraction (0-1)
  metadata?: {
    sourceSection?: string;
    relatedUpdates?: string[];
    affectedServices?: string[];
  };
}

export interface ScrapedData {
  competitor: string;
  updates: ScrapedUpdate[];
  lastScraped: string;
}

// Base scraper class with common functionality
export abstract class BaseCompanyScraper {
  protected browser: Browser | null = null;
  protected abstract companyName: string;
  protected abstract baseUrl: string;

  async init(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Abstract method each company must implement
  abstract scrape(): Promise<ScrapedData>;

  // Smart scraping: Load existing data and determine if we need to scrape
  protected async loadExistingData(): Promise<ScrapedUpdate[]> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const dataPath = path.join(process.cwd(), 'data', `${this.companyName}.json`);
      const data = await fs.readFile(dataPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      return parsed.updates || [];
    } catch (error) {
      console.log(`No existing data found for ${this.companyName}`);
      return [];
    }
  }

  // Check if we need to scrape based on most recent entry
  protected shouldSkipScraping(existingUpdates: ScrapedUpdate[], newUpdates: ScrapedUpdate[]): boolean {
    if (existingUpdates.length === 0) {
      console.log(`${this.companyName}: No existing data, proceeding with full scrape`);
      return false;
    }

    if (newUpdates.length === 0) {
      console.log(`${this.companyName}: No new updates found, skipping`);
      return true;
    }

    // Get the most recent existing update
    const mostRecentExisting = existingUpdates[0]; // Assuming sorted by date desc
    const mostRecentNew = newUpdates[0];

    // Compare titles and dates to see if they match
    const titleMatch = mostRecentExisting.title.trim() === mostRecentNew.title.trim();
    const dateMatch = mostRecentExisting.date === mostRecentNew.date;

    if (titleMatch && dateMatch) {
      console.log(`${this.companyName}: Most recent entry matches existing data, skipping scrape`);
      return true;
    }

    console.log(`${this.companyName}: New updates detected, proceeding with scrape`);
    return false;
  }

  // Filter out updates that already exist
  protected filterNewUpdates(existingUpdates: ScrapedUpdate[], newUpdates: ScrapedUpdate[]): ScrapedUpdate[] {
    if (existingUpdates.length === 0) {
      return newUpdates;
    }

    const existingTitles = new Set(existingUpdates.map(u => u.title.trim()));
    const filtered = newUpdates.filter(update => !existingTitles.has(update.title.trim()));
    
    console.log(`${this.companyName}: Filtered ${newUpdates.length - filtered.length} duplicate updates, ${filtered.length} new updates remaining`);
    return filtered;
  }

  // Smart scraping strategy: scrape minimal content first to check for new updates
  protected async quickScrapeCheck(page: Page): Promise<ScrapedUpdate[]> {
    // Default implementation - subclasses can override for company-specific quick checks
    // This just tries to get the first few entries without loading more content
    console.log(`${this.companyName}: Performing quick scrape check...`);
    
    // Wait for page to load
    await page.waitForNetworkIdle();
    
    // Try to extract just the first few entries using common patterns
    const quickUpdates: ScrapedUpdate[] = [];
    
    try {
      // Look for common changelog entry patterns
      const entries = await page.$$eval('article, .changelog-entry, .release-note, .update-item, [class*="entry"], [class*="item"], [class*="update"], [data-testid*="entry"]', 
        (elements) => {
          return elements.slice(0, 3).map(el => {
            const title = el.querySelector('h1, h2, h3, h4, .title, [class*="title"], [class*="heading"]')?.textContent?.trim() || '';
            const date = el.querySelector('time, .date, [class*="date"], [datetime]')?.textContent?.trim() || '';
            const description = el.querySelector('p, .description, .summary, [class*="description"], [class*="summary"]')?.textContent?.trim() || '';
            
            return { title, date, description };
          }).filter(item => item.title && item.title.length > 0);
        }
      );

      for (const entry of entries) {
        quickUpdates.push({
          title: entry.title,
          date: this.parseDate(entry.date),
          description: entry.description || entry.title,
          type: this.classifyUpdateType(entry.title, entry.description),
          tags: this.extractTags(entry.title + ' ' + entry.description),
          confidence: 0.6, // Lower confidence for quick check
          metadata: {
            sourceSection: `${this.companyName}-quick-check`,
            affectedServices: [this.companyName.charAt(0).toUpperCase() + this.companyName.slice(1) + ' Platform']
          },
          url: this.baseUrl
        });
      }
    } catch (error) {
      console.log(`${this.companyName}: Quick scrape check failed, will proceed with full scrape`);
    }

    return quickUpdates;
  }

  // Common utility methods
  protected async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.init();
    }
    
    const page = await this.browser!.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    return page;
  }

  // Helper method to load more content by scrolling and clicking load more buttons
  protected async loadMoreContent(page: Page): Promise<void> {
    try {
      // Look for "Load More" buttons with various selectors
      const loadMoreSelectors = [
        'button:has-text("Load More")',
        'button:has-text("Show More")',
        'button:has-text("View More")',
        'button:has-text("Load older")',
        'button:has-text("See more")',
        'button:has-text("More")',
        '.load-more',
        '[data-load-more]',
        'button[class*="load"]',
        'button[class*="more"]',
        '.show-more',
        '[data-show-more]',
        '[data-testid*="load"]',
        '[data-testid*="more"]',
        'button[aria-label*="load"]',
        'button[aria-label*="more"]',
        '.pagination-next',
        '.next-page',
        '[data-next]'
      ];
      
      // Try clicking load more buttons multiple times
      for (let i = 0; i < 5; i++) {
        let foundButton = false;
        
        for (const selector of loadMoreSelectors) {
          try {
            const buttons = await page.$$(selector);
            for (const button of buttons) {
              try {
                const isVisible = await button.isVisible();
                if (isVisible) {
                  await button.click();
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  console.log(`Clicked ${selector} button (attempt ${i + 1})`);
                  foundButton = true;
                  break;
                }
              } catch (e) {
                // Continue to next button
              }
            }
            if (foundButton) break;
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (!foundButton) break;
      }
      
      // Try scrolling to load more content (infinite scroll) - more aggressive
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);
      let attempts = 0;
      let noChangeCount = 0;
      
      while (attempts < 25) {
        previousHeight = currentHeight;
        
        // Scroll to bottom
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Also try scrolling to specific positions
        await page.evaluate(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollTo(0, scrollHeight * 0.8);
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
        attempts++;
        
        if (previousHeight === currentHeight) {
          noChangeCount++;
          if (noChangeCount >= 3) break; // Stop if no change for 3 consecutive attempts
        } else {
          noChangeCount = 0;
        }
      }
      
      console.log(`Loaded more content after ${attempts} scroll attempts`);
    } catch (error) {
      console.log('Error loading more content:', error);
    }
  }

  protected parseDate(dateStr: string): string {
    // Common date parsing logic
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    // Handle various date formats
    const cleanDate = dateStr.trim();
    
    // Try parsing different formats
    const formats = [
      // ISO format
      /^\d{4}-\d{2}-\d{2}$/,
      // US format
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      // Month Day, Year
      /^[A-Za-z]+ \d{1,2}, \d{4}$/,
      // Relative dates
      /ago$/i
    ];

    for (const format of formats) {
      if (format.test(cleanDate)) {
        try {
          const parsed = new Date(cleanDate);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
        } catch (e) {
          // Continue to next format
        }
      }
    }

    // Default to current date if parsing fails
    return new Date().toISOString().split('T')[0];
  }

  protected classifyUpdateType(title: string, description: string): ScrapedUpdate['type'] {
    const content = `${title} ${description}`.toLowerCase();
    
    if (content.includes('breaking') || content.includes('deprecated')) return 'breaking';
    if (content.includes('security') || content.includes('vulnerability')) return 'security';
    if (content.includes('performance') || content.includes('speed') || content.includes('faster')) return 'performance';
    if (content.includes('bug') || content.includes('fix') || content.includes('issue')) return 'bugfix';
    if (content.includes('pricing') || content.includes('plan') || content.includes('cost')) return 'pricing';
    if (content.includes('new') || content.includes('add') || content.includes('launch')) return 'feature';
    
    return 'improvement';
  }

  protected extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Common tags across platforms
    const tagMap = {
      'api': ['api', 'rest', 'graphql', 'endpoint'],
      'ui': ['ui', 'interface', 'design', 'dashboard'],
      'mobile': ['mobile', 'ios', 'android', 'app'],
      'web': ['web', 'browser', 'frontend'],
      'backend': ['backend', 'server', 'infrastructure'],
      'database': ['database', 'db', 'sql', 'storage'],
      'auth': ['auth', 'authentication', 'login', 'oauth'],
      'billing': ['billing', 'payment', 'subscription', 'invoice'],
      'security': ['security', 'encryption', 'ssl', 'vulnerability'],
      'performance': ['performance', 'speed', 'optimization', 'faster']
    };

    for (const [tag, keywords] of Object.entries(tagMap)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        tags.push(tag.charAt(0).toUpperCase() + tag.slice(1));
      }
    }

    return [...new Set(tags)];
  }
}

// Stripe-specific scraper
class StripeScraper extends BaseCompanyScraper {
  protected companyName = 'stripe';
  protected baseUrl = 'https://docs.stripe.com/changelog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Stripe changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to load more content by scrolling to load historical data
      await this.loadMoreContent(page);

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Look for the main content area first
        const mainContent = document.querySelector('main, .content, #content, [role="main"]');
        const searchArea = mainContent || document.body;
        
        console.log('=== STRIPE CHANGELOG EXTRACTION ===');
        console.log('Search area:', searchArea.tagName);
        
        // Strategy 1: Look for version headers and their associated content
        const versionHeaders = searchArea.querySelectorAll('h3');
        console.log('Found', versionHeaders.length, 'H3 headers');
        
        for (const header of versionHeaders) {
          const versionTitle = header.textContent?.trim() || '';
          
          // Skip if this doesn't look like a version (should have date format)
          if (!versionTitle.match(/\d{4}-\d{2}-\d{2}/)) continue;
          
          console.log('Processing version:', versionTitle);
          
          // Find the content section for this version
          let currentElement = header.nextElementSibling;
          const subUpdates: any[] = [];
          
          // Look through all following elements until next version
          while (currentElement && currentElement.tagName !== 'H3' && currentElement.tagName !== 'H2') {
            
            // Check all text content in this element for updates
            const allText = currentElement.textContent?.trim() || '';
            
            // Look for bullet points or list-like content
            if (allText.length > 20) {
              
              // Split by common separators to find individual updates
              const possibleUpdates = allText.split(/\n|•|▪|◦|\*/).filter(text => {
                const trimmed = text.trim();
                return trimmed.length > 20 && 
                       (trimmed.toLowerCase().includes('add') || 
                        trimmed.toLowerCase().includes('update') ||
                        trimmed.toLowerCase().includes('fix') ||
                        trimmed.toLowerCase().includes('support') ||
                        trimmed.toLowerCase().includes('new') ||
                        trimmed.toLowerCase().includes('improve'));
              });
              
              for (const updateText of possibleUpdates) {
                const cleanText = updateText.trim();
                if (cleanText.length < 20) continue;
                
                // Extract tags from the content
                const tags: string[] = [];
                const content = cleanText.toLowerCase();
                
                if (content.includes('connect')) tags.push('Connect');
                if (content.includes('payment')) tags.push('Payments');
                if (content.includes('billing')) tags.push('Billing');
                if (content.includes('checkout')) tags.push('Checkout');
                if (content.includes('terminal')) tags.push('Terminal');
                if (content.includes('treasury')) tags.push('Treasury');
                if (content.includes('radar')) tags.push('Radar');
                if (content.includes('identity')) tags.push('Identity');
                if (content.includes('issuing')) tags.push('Issuing');
                if (content.includes('crypto')) tags.push('Crypto');
                if (content.includes('webhook')) tags.push('Webhooks');
                if (content.includes('tax')) tags.push('Tax');
                if (content.includes('invoice')) tags.push('Invoicing');
                if (content.includes('api')) tags.push('API');
                
                subUpdates.push({
                  title: cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText,
                  description: cleanText,
                  tags: [...new Set(tags)],
                  confidence: 0.8
                });
              }
            }
            
            // Also look for structured elements like lists
            const listItems = currentElement.querySelectorAll('li');
            for (const li of listItems) {
              const text = li.textContent?.trim() || '';
              if (text.length < 20) continue;
              
              // Extract tags from the content
              const tags: string[] = [];
              const content = text.toLowerCase();
              
              if (content.includes('connect')) tags.push('Connect');
              if (content.includes('payment')) tags.push('Payments');
              if (content.includes('billing')) tags.push('Billing');
              if (content.includes('checkout')) tags.push('Checkout');
              if (content.includes('terminal')) tags.push('Terminal');
              if (content.includes('treasury')) tags.push('Treasury');
              if (content.includes('radar')) tags.push('Radar');
              if (content.includes('identity')) tags.push('Identity');
              if (content.includes('issuing')) tags.push('Issuing');
              if (content.includes('crypto')) tags.push('Crypto');
              if (content.includes('webhook')) tags.push('Webhooks');
              if (content.includes('tax')) tags.push('Tax');
              if (content.includes('invoice')) tags.push('Invoicing');
              if (content.includes('api')) tags.push('API');
              
              subUpdates.push({
                title: text.length > 100 ? text.substring(0, 100) + '...' : text,
                description: text,
                tags: [...new Set(tags)],
                confidence: 0.9
              });
            }
            
            currentElement = currentElement.nextElementSibling;
          }
          
          console.log(`Found ${subUpdates.length} sub-updates for ${versionTitle}`);
          
          // Create the main version update
          const versionDate = versionTitle.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || new Date().toISOString().split('T')[0];
          
          // Add the main version as an update
          updates.push({
            title: versionTitle,
            date: versionDate,
            description: subUpdates.length > 0 
              ? `Stripe API version ${versionTitle} with ${subUpdates.length} updates`
              : `Stripe API version ${versionTitle}`,
            tags: [...new Set(subUpdates.flatMap(u => u.tags))],
            confidence: 0.95,
            metadata: {
              sourceSection: 'stripe-version-release',
              affectedServices: [...new Set(subUpdates.flatMap(u => u.tags))],
              subUpdates: subUpdates.length
            }
          });
          
          // Add each sub-update as a separate entry
          subUpdates.forEach(subUpdate => {
            updates.push({
              title: `${versionTitle}: ${subUpdate.title}`,
              date: versionDate,
              description: subUpdate.description,
              tags: subUpdate.tags,
              confidence: subUpdate.confidence,
              metadata: {
                sourceSection: 'stripe-sub-update',
                parentVersion: versionTitle,
                affectedServices: subUpdate.tags.length > 0 ? subUpdate.tags : ['Stripe API']
              }
            });
          });
        }
        
        // Strategy 2: Look for any text that looks like changelog entries
        // This is a fallback to catch entries that might not be in the expected structure
        const allTextElements = searchArea.querySelectorAll('p, div, span, li');
        const foundEntries = new Set();
        
        for (const element of allTextElements) {
          const text = element.textContent?.trim() || '';
          
          // Look for text that starts with common changelog patterns
          if (text.length > 30 && 
              (text.toLowerCase().startsWith('add') || 
               text.toLowerCase().startsWith('update') ||
               text.toLowerCase().startsWith('fix') ||
               text.toLowerCase().startsWith('new') ||
               text.toLowerCase().startsWith('improve'))) {
            
            // Avoid duplicates
            if (foundEntries.has(text)) continue;
            foundEntries.add(text);
            
            // Extract tags from the content
            const tags: string[] = [];
            const content = text.toLowerCase();
            
            if (content.includes('connect')) tags.push('Connect');
            if (content.includes('payment')) tags.push('Payments');
            if (content.includes('billing')) tags.push('Billing');
            if (content.includes('checkout')) tags.push('Checkout');
            if (content.includes('terminal')) tags.push('Terminal');
            if (content.includes('treasury')) tags.push('Treasury');
            if (content.includes('radar')) tags.push('Radar');
            if (content.includes('identity')) tags.push('Identity');
            if (content.includes('issuing')) tags.push('Issuing');
            if (content.includes('crypto')) tags.push('Crypto');
            if (content.includes('webhook')) tags.push('Webhooks');
            if (content.includes('tax')) tags.push('Tax');
            if (content.includes('invoice')) tags.push('Invoicing');
            if (content.includes('api')) tags.push('API');
            
            updates.push({
              title: text.length > 100 ? text.substring(0, 100) + '...' : text,
              date: new Date().toISOString().split('T')[0], // Default to today since we can't determine the exact date
              description: text,
              tags: [...new Set(tags)],
              confidence: 0.7,
              metadata: {
                sourceSection: 'stripe-fallback-entry',
                affectedServices: tags.length > 0 ? tags : ['Stripe API']
              }
            });
          }
        }
        
        console.log('Found', updates.length, 'total Stripe changelog entries');
        return updates;
      });

      console.log(`Successfully scraped ${updates.length} Stripe changelog entries`);

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Stripe:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Vercel-specific scraper
class VercelScraper extends BaseCompanyScraper {
  protected companyName = 'vercel';
  protected baseUrl = 'https://vercel.com/changelog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Vercel changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to load more content by scrolling and clicking load more buttons
      await this.loadMoreContent(page);

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Vercel uses article elements for changelog entries - expand selectors
        const entries = document.querySelectorAll('article, [data-changelog-item], .changelog-entry, .update-item, .release-item, [data-testid*="changelog"], [data-testid*="release"]');
        
        console.log('Found', entries.length, 'Vercel changelog entries');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h1, h2, h3, h4, .title, [data-title], .headline, .summary');
          const dateEl = entry.querySelector('[data-date], time, .date, .published, .timestamp, [datetime]');
          const descriptionEl = entry.querySelector('p, .description, [data-description], .content, .excerpt, .summary');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Vercel-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('edge')) tags.push('Edge Functions');
          if (content.includes('next')) tags.push('Next.js');
          if (content.includes('deploy')) tags.push('Deployment');
          if (content.includes('analytics')) tags.push('Analytics');
          if (content.includes('domain')) tags.push('Domains');
          if (content.includes('build')) tags.push('Build System');
          if (content.includes('preview')) tags.push('Preview');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.85,
            metadata: {
              sourceSection: 'vercel-changelog',
              affectedServices: tags.length > 0 ? tags : ['Vercel Platform']
            }
          });
        }
        
        // Fallback strategy: Look for any text content that might be changelog entries
        if (updates.length < 20) {
          console.log('Trying fallback strategy for Vercel...');
          const allElements = document.querySelectorAll('div, section, li, p');
          const foundEntries = new Set();
          
          for (const element of allElements) {
            const text = element.textContent?.trim() || '';
            
            // Look for text that looks like changelog entries
            if (text.length > 20 && text.length < 500 && 
                (text.toLowerCase().includes('deploy') || 
                 text.toLowerCase().includes('build') ||
                 text.toLowerCase().includes('edge') ||
                 text.toLowerCase().includes('function') ||
                 text.toLowerCase().includes('next.js') ||
                 text.toLowerCase().includes('preview') ||
                 text.toLowerCase().includes('update') ||
                 text.toLowerCase().includes('new') ||
                 text.toLowerCase().includes('improve'))) {
              
              // Avoid duplicates and overly long text
              if (foundEntries.has(text) || text.length > 400) continue;
              foundEntries.add(text);
              
              // Extract Vercel-specific tags
              const tags: string[] = [];
              const content = text.toLowerCase();
              
              if (content.includes('edge')) tags.push('Edge Functions');
              if (content.includes('next')) tags.push('Next.js');
              if (content.includes('deploy')) tags.push('Deployment');
              if (content.includes('analytics')) tags.push('Analytics');
              if (content.includes('domain')) tags.push('Domains');
              if (content.includes('build')) tags.push('Build System');
              if (content.includes('preview')) tags.push('Preview');
              
              updates.push({
                title: text.length > 100 ? text.substring(0, 100) + '...' : text,
                date: new Date().toISOString().split('T')[0],
                description: text,
                tags: [...new Set(tags)],
                confidence: 0.6,
                metadata: {
                  sourceSection: 'vercel-fallback-entry',
                  affectedServices: tags.length > 0 ? tags : ['Vercel Platform']
                }
              });
            }
          }
          
          console.log('Found', foundEntries.size, 'additional fallback entries');
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Vercel:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Supabase-specific scraper
class SupabaseScraper extends BaseCompanyScraper {
  protected companyName = 'supabase';
  protected baseUrl = 'https://supabase.com/changelog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Supabase changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to load more content by scrolling and clicking load more buttons
      await this.loadMoreContent(page);

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Supabase uses article elements with specific structure
        const entries = document.querySelectorAll('article, .changelog-item, [data-changelog]');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h2, h3, .title');
          const dateEl = entry.querySelector('.date, time, [data-date]');
          const descriptionEl = entry.querySelector('.description, p:not(.date)');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Supabase-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('database') || content.includes('postgres')) tags.push('Database');
          if (content.includes('auth')) tags.push('Auth');
          if (content.includes('storage')) tags.push('Storage');
          if (content.includes('edge') || content.includes('function')) tags.push('Edge Functions');
          if (content.includes('realtime')) tags.push('Realtime');
          if (content.includes('dashboard')) tags.push('Dashboard');
          if (content.includes('cli')) tags.push('CLI');
          if (content.includes('api')) tags.push('API');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.85,
            metadata: {
              sourceSection: 'supabase-changelog',
              affectedServices: tags.length > 0 ? tags : ['Supabase Platform']
            }
          });
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Supabase:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Figma-specific scraper
class FigmaScraper extends BaseCompanyScraper {
  protected companyName = 'figma';
  protected baseUrl = 'https://www.figma.com/release-notes/';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Figma changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to load more content by scrolling and clicking load more buttons
      await this.loadMoreContent(page);

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Figma uses article elements or specific release note containers - expand selectors
        const entries = document.querySelectorAll('article, [data-release], .release-note, .update-item, .changelog-item, .release-item, [data-testid*="release"], [data-testid*="update"], .feature-update, .product-update');
        
        console.log('Found', entries.length, 'Figma release note entries');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h1, h2, h3, h4, .title, [data-title], .headline, .summary, .feature-title');
          const dateEl = entry.querySelector('.date, time, [data-date], .published, .timestamp, [datetime]');
          const descriptionEl = entry.querySelector('.description, p, .content, .excerpt, .summary, [data-description]');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Figma-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('design')) tags.push('Design');
          if (content.includes('prototype')) tags.push('Prototyping');
          if (content.includes('figjam')) tags.push('FigJam');
          if (content.includes('dev mode')) tags.push('Dev Mode');
          if (content.includes('sites')) tags.push('Figma Sites');
          if (content.includes('slides')) tags.push('Figma Slides');
          if (content.includes('draw')) tags.push('Figma Draw');
          if (content.includes('ai')) tags.push('AI');
          if (content.includes('collaboration')) tags.push('Collaboration');
          if (content.includes('grid')) tags.push('Layout');
          if (content.includes('component')) tags.push('Components');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.9,
            metadata: {
              sourceSection: 'figma-release-notes',
              affectedServices: tags.length > 0 ? tags : ['Figma Platform']
            }
          });
        }
        
        // Fallback strategy: Look for any text content that might be changelog entries
        if (updates.length < 30) {
          console.log('Trying fallback strategy for Figma...');
          const allElements = document.querySelectorAll('div, section, li, p, span');
          const foundEntries = new Set();
          
          for (const element of allElements) {
            const text = element.textContent?.trim() || '';
            
            // Look for text that looks like changelog entries
            if (text.length > 20 && text.length < 500 && 
                (text.toLowerCase().includes('figma') || 
                 text.toLowerCase().includes('design') ||
                 text.toLowerCase().includes('prototype') ||
                 text.toLowerCase().includes('figjam') ||
                 text.toLowerCase().includes('component') ||
                 text.toLowerCase().includes('layer') ||
                 text.toLowerCase().includes('canvas') ||
                 text.toLowerCase().includes('update') ||
                 text.toLowerCase().includes('new') ||
                 text.toLowerCase().includes('improve'))) {
              
              // Avoid duplicates and overly long text
              if (foundEntries.has(text) || text.length > 400) continue;
              foundEntries.add(text);
              
              // Extract Figma-specific tags
              const tags: string[] = [];
              const content = text.toLowerCase();
              
              if (content.includes('design')) tags.push('Design');
              if (content.includes('prototype')) tags.push('Prototyping');
              if (content.includes('figjam')) tags.push('FigJam');
              if (content.includes('dev mode')) tags.push('Dev Mode');
              if (content.includes('sites')) tags.push('Figma Sites');
              if (content.includes('slides')) tags.push('Figma Slides');
              if (content.includes('draw')) tags.push('Figma Draw');
              if (content.includes('ai')) tags.push('AI');
              if (content.includes('collaboration')) tags.push('Collaboration');
              if (content.includes('component')) tags.push('Components');
              
              updates.push({
                title: text.length > 100 ? text.substring(0, 100) + '...' : text,
                date: new Date().toISOString().split('T')[0],
                description: text,
                tags: [...new Set(tags)],
                confidence: 0.6,
                metadata: {
                  sourceSection: 'figma-fallback-entry',
                  affectedServices: tags.length > 0 ? tags : ['Figma Platform']
                }
              });
            }
          }
          
          console.log('Found', foundEntries.size, 'additional fallback entries');
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Figma:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Cal.com-specific scraper
class CalcomScraper extends BaseCompanyScraper {
  protected companyName = 'caldotcom';
  protected baseUrl = 'https://cal.com/blog/category/updates';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Cal.com changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Cal.com blog uses article elements or blog post containers
        const entries = document.querySelectorAll('article, .blog-post, .update-post, [data-post]');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h1, h2, h3, .title, .post-title');
          const dateEl = entry.querySelector('.date, time, .published-date');
          const descriptionEl = entry.querySelector('.excerpt, .description, p');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Cal.com-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('booking')) tags.push('Booking');
          if (content.includes('calendar')) tags.push('Calendar');
          if (content.includes('scheduling')) tags.push('Scheduling');
          if (content.includes('integration')) tags.push('Integrations');
          if (content.includes('workflow')) tags.push('Workflows');
          if (content.includes('payment')) tags.push('Payments');
          if (content.includes('embed')) tags.push('Embed');
          if (content.includes('api')) tags.push('API');
          if (content.includes('team')) tags.push('Teams');
          if (content.includes('routing')) tags.push('Routing');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.85,
            metadata: {
              sourceSection: 'cal-blog-updates',
              affectedServices: tags.length > 0 ? tags : ['Cal.com Platform']
            }
          });
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Cal.com:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Linear-specific scraper
class LinearScraper extends BaseCompanyScraper {
  protected companyName = 'linear';
  protected baseUrl = 'https://linear.app/changelog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Linear changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Linear uses specific changelog item structure
        const entries = document.querySelectorAll('article, .changelog-item, [data-changelog], .update-item');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h2, h3, .title, .changelog-title');
          const dateEl = entry.querySelector('.date, time, .published');
          const descriptionEl = entry.querySelector('.description, .content, p');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Linear-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('issue')) tags.push('Issues');
          if (content.includes('project')) tags.push('Projects');
          if (content.includes('workflow')) tags.push('Workflows');
          if (content.includes('team')) tags.push('Teams');
          if (content.includes('integration')) tags.push('Integrations');
          if (content.includes('api')) tags.push('API');
          if (content.includes('cycle')) tags.push('Cycles');
          if (content.includes('roadmap')) tags.push('Roadmaps');
          if (content.includes('triage')) tags.push('Triage');
          if (content.includes('insight')) tags.push('Insights');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.8,
            metadata: {
              sourceSection: 'linear-changelog',
              affectedServices: tags.length > 0 ? tags : ['Linear Platform']
            }
          });
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Linear:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Notion-specific scraper
class NotionScraper extends BaseCompanyScraper {
  protected companyName = 'notion';
  protected baseUrl = 'https://www.notion.so/releases';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Notion changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to load more content by scrolling and clicking load more buttons
      await this.loadMoreContent(page);

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Notion uses specific release structure - expand selectors
        const entries = document.querySelectorAll('article, .release-item, [data-release], .update-card, .changelog-item, .release-note, [data-testid*="release"], [data-testid*="update"]');
        
        console.log('Found', entries.length, 'Notion release entries');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h1, h2, h3, h4, .title, .release-title, .headline, .summary, [data-title]');
          const dateEl = entry.querySelector('.date, time, .published, .timestamp, [datetime], [data-date]');
          const descriptionEl = entry.querySelector('.description, .content, p, .excerpt, .summary, [data-description]');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Notion-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('database')) tags.push('Database');
          if (content.includes('block')) tags.push('Blocks');
          if (content.includes('template')) tags.push('Templates');
          if (content.includes('formula')) tags.push('Formulas');
          if (content.includes('ai')) tags.push('AI');
          if (content.includes('integration')) tags.push('Integrations');
          if (content.includes('api')) tags.push('API');
          if (content.includes('collaboration')) tags.push('Collaboration');
          if (content.includes('workspace')) tags.push('Workspace');
          if (content.includes('sharing')) tags.push('Sharing');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.85,
            metadata: {
              sourceSection: 'notion-releases',
              affectedServices: tags.length > 0 ? tags : ['Notion Platform']
            }
          });
        }
        
        // Fallback strategy: Look for any text content that might be changelog entries
        if (updates.length < 30) {
          console.log('Trying fallback strategy for Notion...');
          const allElements = document.querySelectorAll('div, section, li, p, span');
          const foundEntries = new Set();
          
          for (const element of allElements) {
            const text = element.textContent?.trim() || '';
            
            // Look for text that looks like changelog entries
            if (text.length > 20 && text.length < 500 && 
                (text.toLowerCase().includes('notion') || 
                 text.toLowerCase().includes('database') ||
                 text.toLowerCase().includes('block') ||
                 text.toLowerCase().includes('template') ||
                 text.toLowerCase().includes('formula') ||
                 text.toLowerCase().includes('workspace') ||
                 text.toLowerCase().includes('page') ||
                 text.toLowerCase().includes('update') ||
                 text.toLowerCase().includes('new') ||
                 text.toLowerCase().includes('improve'))) {
              
              // Avoid duplicates and overly long text
              if (foundEntries.has(text) || text.length > 400) continue;
              foundEntries.add(text);
              
              // Extract Notion-specific tags
              const tags: string[] = [];
              const content = text.toLowerCase();
              
              if (content.includes('database')) tags.push('Database');
              if (content.includes('block')) tags.push('Blocks');
              if (content.includes('template')) tags.push('Templates');
              if (content.includes('formula')) tags.push('Formulas');
              if (content.includes('ai')) tags.push('AI');
              if (content.includes('integration')) tags.push('Integrations');
              if (content.includes('api')) tags.push('API');
              if (content.includes('collaboration')) tags.push('Collaboration');
              if (content.includes('workspace')) tags.push('Workspace');
              if (content.includes('sharing')) tags.push('Sharing');
              
              updates.push({
                title: text.length > 100 ? text.substring(0, 100) + '...' : text,
                date: new Date().toISOString().split('T')[0],
                description: text,
                tags: [...new Set(tags)],
                confidence: 0.6,
                metadata: {
                  sourceSection: 'notion-fallback-entry',
                  affectedServices: tags.length > 0 ? tags : ['Notion Platform']
                }
              });
            }
          }
          
          console.log('Found', foundEntries.size, 'additional fallback entries');
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Notion:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// ConvertKit-specific scraper
class ConvertkitScraper extends BaseCompanyScraper {
  protected companyName = 'convertkit';
  protected baseUrl = 'https://updates.kit.com/changelog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping ConvertKit changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // ConvertKit uses changelog structure
        const entries = document.querySelectorAll('article, .changelog-item, [data-changelog], .update-item');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h2, h3, .title, .changelog-title');
          const dateEl = entry.querySelector('.date, time, .published');
          const descriptionEl = entry.querySelector('.description, .content, p');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // ConvertKit-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('email')) tags.push('Email');
          if (content.includes('automation')) tags.push('Automation');
          if (content.includes('form')) tags.push('Forms');
          if (content.includes('landing')) tags.push('Landing Pages');
          if (content.includes('sequence')) tags.push('Sequences');
          if (content.includes('broadcast')) tags.push('Broadcasts');
          if (content.includes('subscriber')) tags.push('Subscribers');
          if (content.includes('integration')) tags.push('Integrations');
          if (content.includes('commerce')) tags.push('Commerce');
          if (content.includes('creator')) tags.push('Creator Studio');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.8,
            metadata: {
              sourceSection: 'convertkit-changelog',
              affectedServices: tags.length > 0 ? tags : ['ConvertKit Platform']
            }
          });
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping ConvertKit:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Gumroad-specific scraper
class GumroadScraper extends BaseCompanyScraper {
  protected companyName = 'gumroad';
  protected baseUrl = 'https://gumroad.com/blog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Gumroad blog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Gumroad blog uses article elements or blog post containers
        const entries = document.querySelectorAll('article, .blog-post, .post, [data-post]');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h1, h2, h3, .title, .post-title');
          const dateEl = entry.querySelector('.date, time, .published-date');
          const descriptionEl = entry.querySelector('.excerpt, .description, p');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Filter for product updates (not just any blog post)
          const content = `${title} ${description}`.toLowerCase();
          if (!content.includes('update') && !content.includes('feature') && !content.includes('new') && 
              !content.includes('launch') && !content.includes('improvement') && !content.includes('change')) {
            continue;
          }
          
          // Gumroad-specific tags
          const tags: string[] = [];
          
          if (content.includes('creator')) tags.push('Creator Tools');
          if (content.includes('payment')) tags.push('Payments');
          if (content.includes('analytics')) tags.push('Analytics');
          if (content.includes('marketing')) tags.push('Marketing');
          if (content.includes('affiliate')) tags.push('Affiliates');
          if (content.includes('checkout')) tags.push('Checkout');
          if (content.includes('storefront')) tags.push('Storefront');
          if (content.includes('mobile')) tags.push('Mobile');
          if (content.includes('api')) tags.push('API');
          if (content.includes('integration')) tags.push('Integrations');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.75,
            metadata: {
              sourceSection: 'gumroad-blog',
              affectedServices: tags.length > 0 ? tags : ['Gumroad Platform']
            }
          });
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Gumroad:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Carrd-specific scraper
class CarrdScraper extends BaseCompanyScraper {
  protected companyName = 'carrd';
  protected baseUrl = 'https://carrd.co/changelog';

  async scrape(): Promise<ScrapedData> {
    const page = await this.createPage();
    
    try {
      console.log('Scraping Carrd changelog...');
      
      await page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const updates = await page.evaluate(() => {
        const updates: any[] = [];
        
        // Carrd uses changelog structure
        const entries = document.querySelectorAll('article, .changelog-item, [data-changelog], .update-item');
        
        for (const entry of entries) {
          const titleEl = entry.querySelector('h2, h3, .title, .changelog-title');
          const dateEl = entry.querySelector('.date, time, .published');
          const descriptionEl = entry.querySelector('.description, .content, p');
          
          if (!titleEl) continue;
          
          const title = titleEl.textContent?.trim() || '';
          const date = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '';
          const description = descriptionEl?.textContent?.trim() || '';
          
          if (title.length < 5) continue;
          
          // Carrd-specific tags
          const tags: string[] = [];
          const content = `${title} ${description}`.toLowerCase();
          
          if (content.includes('template')) tags.push('Templates');
          if (content.includes('element')) tags.push('Elements');
          if (content.includes('form')) tags.push('Forms');
          if (content.includes('embed')) tags.push('Embeds');
          if (content.includes('responsive')) tags.push('Responsive');
          if (content.includes('domain')) tags.push('Domains');
          if (content.includes('publish')) tags.push('Publishing');
          if (content.includes('editor')) tags.push('Editor');
          if (content.includes('integration')) tags.push('Integrations');
          if (content.includes('pro')) tags.push('Pro Features');
          
          updates.push({
            title,
            date: date || new Date().toISOString().split('T')[0],
            description: description.substring(0, 400),
            tags: [...new Set(tags)],
            confidence: 0.8,
            metadata: {
              sourceSection: 'carrd-changelog',
              affectedServices: tags.length > 0 ? tags : ['Carrd Platform']
            }
          });
        }
        
        return updates;
      });

      return {
        competitor: this.companyName,
        updates: updates.map(update => ({
          ...update,
          type: this.classifyUpdateType(update.title, update.description),
          url: this.baseUrl
        })),
        lastScraped: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error scraping Carrd:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
}

// Main scraper orchestrator - updated constructor
export class ChangelogScraper {
  private scrapers: Map<string, BaseCompanyScraper> = new Map();

  constructor() {
    // Register company-specific scrapers
    this.scrapers.set('stripe', new StripeScraper());
    this.scrapers.set('vercel', new VercelScraper());
    this.scrapers.set('supabase', new SupabaseScraper());
    this.scrapers.set('figma', new FigmaScraper());
    this.scrapers.set('caldotcom', new CalcomScraper());
    this.scrapers.set('linear', new LinearScraper());
    this.scrapers.set('notion', new NotionScraper());
    this.scrapers.set('convertkit', new ConvertkitScraper());
    this.scrapers.set('gumroad', new GumroadScraper());
    this.scrapers.set('carrd', new CarrdScraper());
  }

  async scrapeCompany(companyName: string): Promise<ScrapedData> {
    const scraper = this.scrapers.get(companyName);
    if (!scraper) {
      throw new Error(`No scraper found for company: ${companyName}`);
    }

    try {
      await scraper.init();
      
      // Smart scraping: load existing data first
      console.log(`${companyName}: Loading existing data for smart scraping...`);
      const existingUpdates = await (scraper as any).loadExistingData();
      
      if (existingUpdates.length > 0) {
        console.log(`${companyName}: Found ${existingUpdates.length} existing updates, performing quick check...`);
        
        // Create a page for quick check
        const page = await (scraper as any).createPage();
        try {
          await page.goto((scraper as any).baseUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          // Perform quick scrape to get just the latest few entries
          const quickUpdates = await (scraper as any).quickScrapeCheck(page);
          
          // Check if we should skip full scraping
          if ((scraper as any).shouldSkipScraping(existingUpdates, quickUpdates)) {
            console.log(`${companyName}: No new updates detected, returning existing data`);
            return {
              competitor: companyName,
              updates: existingUpdates,
              lastScraped: new Date().toISOString()
            };
          }
        } finally {
          await page.close();
        }
      }
      
      // Proceed with full scraping if new updates detected or no existing data
      console.log(`${companyName}: Proceeding with full scrape...`);
      const fullData = await scraper.scrape();
      
      // Filter out duplicates if we have existing data
      if (existingUpdates.length > 0) {
        const newUpdates = (scraper as any).filterNewUpdates(existingUpdates, fullData.updates);
        const combinedUpdates = [...newUpdates, ...existingUpdates];
        
        return {
          ...fullData,
          updates: combinedUpdates
        };
      }
      
      return fullData;
    } finally {
      await scraper.close();
    }
  }

  async scrapeAllChangelogs(): Promise<ScrapedData[]> {
    const results: ScrapedData[] = [];
    
    for (const [companyName, scraper] of this.scrapers) {
      try {
        console.log(`Scraping ${companyName}...`);
        const data = await this.scrapeCompany(companyName);
        results.push(data);
        console.log(`Successfully scraped ${companyName}: ${data.updates.length} updates`);
      } catch (error) {
        console.error(`Failed to scrape ${companyName}:`, error);
        // Continue with other scrapers
      }
    }
    
    return results;
  }

  // Method to add new scrapers dynamically
  addScraper(companyName: string, scraper: BaseCompanyScraper): void {
    this.scrapers.set(companyName, scraper);
  }

  // Get list of supported companies
  getSupportedCompanies(): string[] {
    return Array.from(this.scrapers.keys());
  }
}

// Helper function to convert scraped data to our Update interface
export function convertScrapedToUpdate(scraped: ScrapedUpdate, competitor: string, id: number): any {
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

  // Determine impact based on content
  const getImpact = (title: string, description: string): 'high' | 'medium' | 'low' => {
    const content = (title + ' ' + description).toLowerCase();
    
    if (content.includes('major') || content.includes('breaking') || content.includes('launch') || 
        content.includes('new api') || content.includes('deprecat')) {
      return 'high';
    } else if (content.includes('improv') || content.includes('enhanc') || content.includes('updat')) {
      return 'medium';
    } else {
      return 'low';
    }
  };

  // Generate realistic changes based on the update
  const generateChanges = (scraped: ScrapedUpdate) => {
    const changes = {
      added: [] as string[],
      modified: [] as string[],
      removed: [] as string[]
    };

    if (scraped.type === 'feature') {
      changes.added.push(scraped.title);
      if (scraped.category) {
        changes.added.push(`${scraped.category} integration`);
      }
    } else if (scraped.type === 'improvement') {
      changes.modified.push(scraped.title);
      changes.modified.push('Performance optimizations');
    } else if (scraped.type === 'bugfix') {
      changes.modified.push(scraped.title);
    }

    return changes;
  };

  return {
    id,
    competitor,
    title: scraped.title,
    type: scraped.type,
    timestamp: getRelativeTime(scraped.date),
    impact: getImpact(scraped.title, scraped.description),
    changes: generateChanges(scraped),
    screenshot: `data:image/svg+xml;base64,${btoa(`<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f9ff"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" fill="#374149" text-anchor="middle" dy=".3em">${scraped.title}</text></svg>`)}`
  };
} 