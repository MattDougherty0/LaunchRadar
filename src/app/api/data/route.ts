import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json') && file !== 'scraping-log.json');
    
    const companies = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(dataDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        if (data.updates && Array.isArray(data.updates)) {
          companies.push({
            competitor: data.competitor || file.replace('.json', ''),
            updates: data.updates,
            lastScraped: data.lastScraped,
            success: data.success
          });
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
      }
    }
    
    console.log(`Loaded ${companies.length} stored datasets from disk`);
    
    return NextResponse.json({ 
      success: true, 
      data: companies,
      fromCache: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error loading stored data:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to load stored data',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 