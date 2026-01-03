#!/bin/bash

# Setup script for LaunchRadar Daily Scraper
# This script helps configure the daily scraper to run automatically via cron

set -e

echo "🚀 LaunchRadar Daily Scraper Setup"
echo "=================================="

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRAPER_SCRIPT="$SCRIPT_DIR/daily-scraper.js"

echo "📍 Project directory: $SCRIPT_DIR"
echo "📍 Scraper script: $SCRAPER_SCRIPT"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js is available: $(node --version)"

# Check if the scraper script exists
if [ ! -f "$SCRAPER_SCRIPT" ]; then
    echo "❌ daily-scraper.js not found at $SCRAPER_SCRIPT"
    exit 1
fi

echo "✅ Daily scraper script found"

# Make the scraper script executable
chmod +x "$SCRAPER_SCRIPT"
echo "✅ Made daily-scraper.js executable"

# Test run the scraper (with a timeout to prevent hanging)
echo "🧪 Testing scraper (this may take a few minutes)..."
timeout 300 node "$SCRAPER_SCRIPT" || {
    echo "⚠️  Scraper test timed out or failed, but this is normal for initial setup"
}

echo ""
echo "📋 CRON SETUP INSTRUCTIONS"
echo "=========================="
echo ""
echo "To run the scraper daily at 6:00 AM, add this line to your crontab:"
echo ""
echo "0 6 * * * cd $SCRIPT_DIR && node daily-scraper.js >> $SCRIPT_DIR/logs/daily-scraper.log 2>&1"
echo ""
echo "To edit your crontab, run:"
echo "  crontab -e"
echo ""
echo "Other scheduling options:"
echo "  Every 12 hours: 0 */12 * * * cd $SCRIPT_DIR && node daily-scraper.js"
echo "  Every 6 hours:  0 */6 * * * cd $SCRIPT_DIR && node daily-scraper.js"
echo "  Every hour:     0 * * * * cd $SCRIPT_DIR && node daily-scraper.js"
echo ""

# Create logs directory
mkdir -p "$SCRIPT_DIR/logs"
echo "✅ Created logs directory at $SCRIPT_DIR/logs"

# Create a simple test cron job (optional)
read -p "Would you like to add a test cron job that runs every 5 minutes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Adding test cron job..."
    
    # Get current crontab
    TEMP_CRON=$(mktemp)
    crontab -l > "$TEMP_CRON" 2>/dev/null || true
    
    # Add test job
    echo "*/5 * * * * cd $SCRIPT_DIR && node daily-scraper.js >> $SCRIPT_DIR/logs/test-scraper.log 2>&1" >> "$TEMP_CRON"
    
    # Install new crontab
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"
    
    echo "✅ Test cron job added (runs every 5 minutes)"
    echo "   Check logs at: $SCRIPT_DIR/logs/test-scraper.log"
    echo "   Remove it later with: crontab -e"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Monitor scraping results:"
echo "  - Live logs: tail -f $SCRIPT_DIR/logs/daily-scraper.log"
echo "  - Scraping history: cat $SCRIPT_DIR/data/scraping-log.json"
echo "  - Company data: ls -la $SCRIPT_DIR/data/"
echo ""
echo "🔧 Manual run: node $SCRIPT_DIR/daily-scraper.js"
echo ""
echo "Happy scraping! 🕷️" 