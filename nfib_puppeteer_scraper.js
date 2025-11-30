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

/**
 * Extract seasonally adjusted data for a specific indicator
 * @param {string} indicatorCode - The indicator code (e.g., 'expand_good', 'OPT_INDEX')
 * @param {number} numMonths - How many recent months to extract (default: 12)
 */
async function scrapeNFIBIndicator(indicatorCode = 'expand_good', numMonths = 12) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Navigate to the NFIB Indicators page
        await page.goto('https://www.nfib-sbet.org/Indicators.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for the page to fully load
        await page.waitForSelector('#indicators1', { timeout: 30000 });

        // Select the desired indicator from the dropdown
        await page.evaluate((code) => {
            const select = document.getElementById('indicators1');
            select.value = code;
            // Trigger the change event to load data
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        }, indicatorCode);

        // Wait for the chart to render with data
        await page.waitForTimeout(5000); // Give it time to fetch and render

        // Extract the data from the Kendo chart
        const chartData = await page.evaluate(() => {
            // The Kendo chart stores data in the dataSource
            const chart = $('#indicatorChart').data('kendoStockChart') || $('#indicatorChart').data('kendoChart');
            
            if (!chart) {
                return { error: 'Chart not found' };
            }

            const dataSource = chart.dataSource;
            const data = dataSource.data();
            
            // Extract the values
            const results = [];
            data.forEach(item => {
                results.push({
                    date: item.monthyear,
                    value: item.percent || item.value || item[Object.keys(item).find(k => typeof item[k] === 'number')]
                });
            });

            return results;
        });

        if (chartData.error) {
            throw new Error(chartData.error);
        }

        // Get the most recent N months
        const recentData = chartData.slice(-numMonths);

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
 * Extract multiple indicators at once
 */
async function scrapeMultipleIndicators(indicators, numMonths = 12) {
    const results = {};
    
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
