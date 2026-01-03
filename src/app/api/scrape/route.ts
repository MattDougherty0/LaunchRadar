import { NextRequest, NextResponse } from 'next/server';
import { ChangelogScraper } from '@/services/changelog-scraper';
import { DataStore } from '@/services/data-store';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source'); // 'stripe', 'figma', etc. or 'all'
  
  const dataStore = new DataStore();
  
  try {
    const scraper = new ChangelogScraper();
    
    let result;
    
    if (source && source !== 'all') {
      // Scrape specific company
      result = await scraper.scrapeCompany(source);
      // Store successful result
      await dataStore.store(source, result);
    } else {
      // Scrape all sources
      result = await scraper.scrapeAllChangelogs();
      // Store each result
      if (Array.isArray(result)) {
        for (const data of result) {
          await dataStore.store(data.competitor, data);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    
    // Try to return stored data as fallback
    if (source && source !== 'all') {
      const storedData = await dataStore.retrieve(source);
      if (storedData && storedData.success) {
        console.log(`Returning stored data for ${source} due to scraping error`);
        return NextResponse.json({ 
          success: true, 
          data: storedData,
          fromCache: true,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Return all stored data
      const allStoredData = await dataStore.retrieveAll();
      if (allStoredData.length > 0) {
        console.log(`Returning stored data for all sources due to scraping error`);
        return NextResponse.json({ 
          success: true, 
          data: allStoredData,
          fromCache: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sources } = body; // Array of sources to scrape
    
    const scraper = new ChangelogScraper();
    const results = [];
    
    for (const source of sources) {
      try {
        const result = await scraper.scrapeCompany(source);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
        // Continue with other sources even if one fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 