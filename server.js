/**
 * Express API Server for NFIB Data Scraping
 * 
 * Deploy this to Render.com to create an API endpoint
 * that n8n can call to get seasonally adjusted NFIB data
 */

const express = require('express');
const { scrapeNFIBIndicator, scrapeMultipleIndicators } = require('./nfib_puppeteer_scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * GET /scrape?indicator=expand_good&date=10/1/2025
 *
 * Scrapes a single indicator
 * - If date is provided, returns data for that specific date
 * - If no date is provided, returns the entire time series
 */
app.get('/scrape', async (req, res) => {
    try {
        const indicator = req.query.indicator;
        const requestedDate = req.query.date;

        if (!indicator) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: indicator',
                indicator: null,
                date: null,
                value: null
            });
        }

        console.log(`[${new Date().toISOString()}] Scraping indicator: ${indicator}${requestedDate ? ` for date: ${requestedDate}` : ' (all dates)'}`);

        // Get all data (we'll filter by date if needed)
        const data = await scrapeNFIBIndicator(indicator, 999);

        if (requestedDate) {
            // Filter to the specific date
            const match = data.data.find(item => item.date === requestedDate);

            if (!match) {
                return res.status(404).json({
                    success: false,
                    indicator: indicator,
                    date: requestedDate,
                    value: null,
                    error: `No data found for date: ${requestedDate}`,
                    scraped_at: data.scraped_at
                });
            }

            res.json({
                success: true,
                indicator: indicator,
                date: match.date,
                value: match.value,
                scraped_at: data.scraped_at
            });

            console.log(`[${new Date().toISOString()}] Successfully scraped ${indicator} for ${requestedDate}: ${match.value}`);

        } else {
            // Return all data
            res.json({
                success: true,
                indicator: indicator,
                data: data.data,
                count: data.data.length,
                scraped_at: data.scraped_at
            });

            console.log(`[${new Date().toISOString()}] Successfully scraped ${indicator}: ${data.data.length} data points`);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error scraping ${req.query.indicator}:`, error.message);

        res.status(500).json({
            success: false,
            indicator: req.query.indicator,
            date: req.query.date || null,
            value: null,
            error: error.message,
            error_type: error.name,
            scraped_at: new Date().toISOString()
        });
    }
});

/**
 * POST /scrape-multiple
 * Body: { "indicators": ["expand_good", "OPT_INDEX"], "months": 12 }
 * 
 * Scrapes multiple indicators
 */
app.post('/scrape-multiple', async (req, res) => {
    try {
        const indicators = req.body.indicators || ['OPT_INDEX'];
        const months = req.body.months || 12;

        const data = await scrapeMultipleIndicators(indicators, months);
        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /debug
 * Debug endpoint to check Chrome installation
 */
app.get('/debug', (req, res) => {
    const { execSync } = require('child_process');

    try {
        const chromePath = execSync('find /opt/render/.cache/puppeteer -name chrome -type f 2>/dev/null | head -1').toString().trim();
        const cacheContents = execSync('ls -la /opt/render/.cache/puppeteer 2>&1').toString();

        res.json({
            environment: process.env.RENDER ? 'Render' : 'Local',
            chromePath: chromePath || 'Not found',
            cacheDirectory: cacheContents.split('\n').slice(0, 20)
        });
    } catch (error) {
        res.json({
            environment: process.env.RENDER ? 'Render' : 'Local',
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * GET /indicators
 * List available indicators
 */
app.get('/indicators', (req, res) => {
    res.json({
        indicators: [
            { code: 'OPT_INDEX', name: 'Small Business Optimism Index' },
            { code: 'emp_count_change_expect', name: 'Plans to Increase Employment' },
            { code: 'cap_ex_expect', name: 'Plans to Make Capital Outlays' },
            { code: 'inventory_expect', name: 'Plans to Increase Inventories' },
            { code: 'bus_cond_expect', name: 'Expect Economy to Improve' },
            { code: 'sales_expect', name: 'Expect Real Sales Higher' },
            { code: 'inventory_current', name: 'Current Inventory' },
            { code: 'job_opening_unfilled', name: 'Current Job Openings' },
            { code: 'credit_access_expect', name: 'Expected Credit Conditions' },
            { code: 'expand_good', name: 'Now a Good Time to Expand' },
            { code: 'earn_change', name: 'Earnings Trends' },
            { code: 'sales_change', name: 'Actual Sales Changes' },
            { code: 'price_change', name: 'Actual Price Changes' },
            { code: 'price_change_plan', name: 'Price Plans' },
            { code: 'emp_count_change', name: 'Actual Employment Changes' },
            { code: 'emp_comp_change', name: 'Actual Compensation Changes' },
            { code: 'emp_comp_change_expect', name: 'Compensation Plans' },
            { code: 'rate_change', name: 'Relative Interest Rate Paid by Regular Borrowers' },
            { code: 'inventory_change', name: 'Actual Inventory Changes' },
            { code: 'qualified_appl', name: 'Qualified Applicants for Job Openings' },
            { code: 'un_index', name: 'Uncertainty Index' }
        ]
    });
});

app.listen(PORT, () => {
    console.log(`NFIB Scraper API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Scrape endpoint: http://localhost:${PORT}/scrape?indicator=expand_good&months=1`);
});

module.exports = app;
