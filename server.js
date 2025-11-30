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
 * GET /scrape?indicator=expand_good&months=12
 * 
 * Scrapes a single indicator
 */
app.get('/scrape', async (req, res) => {
    try {
        const indicator = req.query.indicator || 'expand_good';
        const months = parseInt(req.query.months) || 12;

        const data = await scrapeNFIBIndicator(indicator, months);
        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: error.message,
            indicator: req.query.indicator
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
