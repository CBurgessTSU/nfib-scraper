/**
 * NFIB Seasonally Adjusted Data Scraper
 * 
 * This script uses Puppeteer to load the NFIB Indicators page,
 * wait for JavaScript to apply seasonal adjustments, and extract
 * the precise seasonally adjusted values from the rendered chart data.
 * 
 * Deploy this as a simple Express server on Render.com,
 * then call it from n8n to get the data.
 */

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

/**
 * Extract seasonally adjusted data for a specific indicator
 * @param {string} indicatorCode - The indicator code (e.g., 'expand_good', 'OPT_INDEX')
 * @param {number} numMonths - How many recent months to extract (default: 12)
 */
async function scrapeNFIBIndicator(indicatorCode = 'expand_good', numMonths = 12) {
    // Puppeteer launch options - handle both local and Render environments
    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    };

    // On Render, find Chrome dynamically
    if (process.env.RENDER) {
        try {
            // Find Chrome in the Puppeteer cache
            const chromePath = execSync('find /opt/render/.cache/puppeteer -name chrome -type f 2>/dev/null | head -1').toString().trim();
            if (chromePath) {
                launchOptions.executablePath = chromePath;
                console.log(`Using Chrome at: ${chromePath}`);
            }
        } catch (error) {
            console.error('Error finding Chrome:', error.message);
        }
    }

    const browser = await puppeteer.launch(launchOptions);

    try {
        const page = await browser.newPage();

        // Navigate to the NFIB Indicators page
        await page.goto('https://www.nfib-sbet.org/Indicators.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for the page to fully load
        await page.waitForSelector('#indicators1', { timeout: 30000 });

        // Select the desired indicator using Puppeteer's select method
        await page.select('#indicators1', indicatorCode);

        // Click SHOW RESULTS button using real click (not JavaScript click)
        const showResultsButtons = await page.$$('#showResults');
        if (showResultsButtons.length > 0) {
            await showResultsButtons[0].click();
        } else {
            throw new Error('SHOW RESULTS button not found');
        }

        // IMPORTANT: The site says "Please allow 1 minute when loading the Optimism Index & Uncertainty Index
        // and 10-15 seconds when loading other indecies"
        const isSlowIndicator = indicatorCode === 'OPT_INDEX' || indicatorCode === 'un_index';
        const maxWaitTime = isSlowIndicator ? 90000 : 40000; // 90s for slow ones, 40s for others

        // Wait for the chart to be recreated with data (uses generic "indexvalue" field after clicking SHOW RESULTS)
        await page.waitForFunction(() => {
            const chart = $('#indicatorChart').data('kendoStockChart') || $('#indicatorChart').data('kendoChart');
            if (!chart) return false;
            const dataSource = chart.dataSource;
            if (!dataSource) return false;
            const data = dataSource.data();
            if (!data || data.length === 0) return false;
            // After clicking SHOW RESULTS, the data uses "indexvalue" field
            return data[0].hasOwnProperty('indexvalue');
        }, { timeout: maxWaitTime });

        // Extract the data from the Kendo chart
        const chartData = await page.evaluate(() => {
            // The Kendo chart stores data in the dataSource
            const chart = $('#indicatorChart').data('kendoStockChart') || $('#indicatorChart').data('kendoChart');

            if (!chart) {
                return { error: 'Chart not found' };
            }

            const dataSource = chart.dataSource;
            const data = dataSource.data();

            // Extract the values - after clicking SHOW RESULTS, data uses "indexvalue" field
            // and is sorted oldest-first
            const results = [];
            data.forEach(item => {
                results.push({
                    date: item.monthyear,
                    value: item.indexvalue
                });
            });

            return { results, totalCount: data.length };
        });

        if (chartData.error) {
            throw new Error(chartData.error);
        }

        // Get the most recent N months (data is sorted oldest-first, so take from the end)
        const recentData = chartData.results.slice(-numMonths);

        return {
            indicator: indicatorCode,
            data: recentData,
            scraped_at: new Date().toISOString()
        };

    } catch (error) {
        throw new Error(`Failed to scrape NFIB data: ${error.message}`);
    } finally {
        await browser.close();
    }
}

/**
 * Extract multiple indicators at once (sequentially to avoid overwhelming the site)
 */
async function scrapeMultipleIndicators(indicators, numMonths = 12) {
    const results = {};

    // Scrape indicators one at a time (site is too slow for parallel requests)
    for (const indicator of indicators) {
        console.log(`Scraping ${indicator}...`);
        try {
            results[indicator] = await scrapeNFIBIndicator(indicator, numMonths);
        } catch (error) {
            results[indicator] = { error: error.message };
        }
    }

    return results;
}

// If running as standalone script
if (require.main === module) {
    // Example: Get the most recent value for "Now a Good Time to Expand"
    scrapeNFIBIndicator('expand_good', 1)
        .then(data => {
            console.log(JSON.stringify(data, null, 2));
        })
        .catch(error => {
            console.error('Error:', error.message);
            process.exit(1);
        });
}

module.exports = {
    scrapeNFIBIndicator,
    scrapeMultipleIndicators
};
