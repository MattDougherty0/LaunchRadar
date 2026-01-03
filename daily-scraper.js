#!/usr/bin/env node

/**
 * Daily Scraper Script for LaunchRadar
 * 
 * This script runs all company scrapers automatically and can be scheduled via cron.
 * Usage: node daily-scraper.js
 * 
 * Cron example (daily at 6 AM):
 * 0 6 * * * cd /path/to/launchradar && node daily-scraper.js
 */

// Use API endpoints since we're avoiding direct imports
const fs = require('fs').promises;
const path = require('path');

// Helper function to call our API
async function callAPI(endpoint) {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(`http://localhost:3000${endpoint}`);
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
    console.log('Created data directory');
  }
}

async function saveCompanyData(companyName, data) {
  const filePath = path.join(__dirname, 'data', `${companyName}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved ${data.updates.length} updates for ${companyName}`);
}

async function logScrapingResults(results) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    totalCompanies: results.length,
    successfulScrapes: results.filter(r => r.success).length,
    failedScrapes: results.filter(r => !r.success).length,
    totalUpdates: results.reduce((sum, r) => sum + (r.updates || 0), 0),
    companies: results.map(r => ({
      name: r.company,
      success: r.success,
      updates: r.updates || 0,
      error: r.error || null
    }))
  };

  const logPath = path.join(__dirname, 'data', 'scraping-log.json');
  
  // Load existing logs
  let logs = [];
  try {
    const existingLogs = await fs.readFile(logPath, 'utf-8');
    logs = JSON.parse(existingLogs);
  } catch (error) {
    // File doesn't exist yet, start fresh
  }

  // Add new log entry and keep only last 30 days
  logs.unshift(logEntry);
  logs = logs.slice(0, 30);

  await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
  console.log(`📊 Logged scraping results to ${logPath}`);
}

async function runDailyScraper() {
  console.log('🚀 Starting daily scraper at', new Date().toISOString());
  
  await ensureDataDirectory();
  
  // Use API to get supported companies and scrape
  // Temporarily excluding stripe to avoid over-scraping, and problematic sites
  const supportedCompanies = ['vercel', 'supabase', 'figma', 'notion', 'gumroad'];
  const results = [];

  console.log(`📋 Found ${supportedCompanies.length} companies to scrape:`, supportedCompanies.join(', '));

  for (const company of supportedCompanies) {
    console.log(`\n🔍 Scraping ${company}...`);
    
    try {
      const startTime = Date.now();
      
      // Call the scrape API for this company
      const apiResult = await callAPI(`/api/scrape?company=${company}`);
      const endTime = Date.now();
      
      if (apiResult.success && apiResult.data) {
        // Handle both single company and array responses
        const companyData = Array.isArray(apiResult.data) ? 
          apiResult.data.find(c => c.competitor === company) || apiResult.data[0] : 
          apiResult.data;
        
        if (companyData && companyData.updates && Array.isArray(companyData.updates)) {
          results.push({
            company,
            success: true,
            updates: companyData.updates.length,
            duration: endTime - startTime
          });
          
          console.log(`✅ ${company}: ${companyData.updates.length} updates (${endTime - startTime}ms)`);
        } else {
          throw new Error('No updates found in API response');
        }
      } else {
        throw new Error(apiResult.error || 'Unknown API error');
      }
      
    } catch (error) {
      console.error(`❌ ${company}: Failed -`, error.message);
      
      results.push({
        company,
        success: false,
        error: error.message,
        duration: 0
      });
    }

    // Small delay between scrapers to be respectful
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Log results
  await logScrapingResults(results);

  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalUpdates = successful.reduce((sum, r) => sum + r.updates, 0);

  console.log('\n📈 DAILY SCRAPING SUMMARY');
  console.log('========================');
  console.log(`✅ Successful: ${successful.length}/${results.length} companies`);
  console.log(`❌ Failed: ${failed.length}/${results.length} companies`);
  console.log(`📊 Total updates collected: ${totalUpdates}`);
  
  if (successful.length > 0) {
    console.log('\n🎯 Successful companies:');
    successful.forEach(r => {
      console.log(`   • ${r.company}: ${r.updates} updates (${r.duration}ms)`);
    });
  }

  if (failed.length > 0) {
    console.log('\n⚠️  Failed companies:');
    failed.forEach(r => {
      console.log(`   • ${r.company}: ${r.error}`);
    });
  }

  console.log('\n🏁 Daily scraping completed at', new Date().toISOString());
  
  // Exit with appropriate code
  process.exit(failed.length === results.length ? 1 : 0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the scraper
runDailyScraper().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 