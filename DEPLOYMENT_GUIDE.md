# NFIB Seasonally Adjusted Data Extraction - Complete Solution

## The Problem

The NFIB Indicators page (https://www.nfib-sbet.org/Indicators.html) displays precise seasonally adjusted data (e.g., 11.746%), but:
- The API only returns raw, non-seasonally adjusted data
- The seasonal adjustment is done client-side using complex regression algorithms in JavaScript
- PDF reports only show rounded values (11%)

## The Solution

Use a headless browser (Puppeteer) to:
1. Load the page and let JavaScript execute
2. Select the desired indicator
3. Extract the seasonally adjusted data from the rendered chart
4. Return the precise values

---

## Deployment to Render.com

### Step 1: Create the Service

1. Create a new folder for your project
2. Add these three files:
   - `nfib_puppeteer_scraper.js` (the scraper logic)
   - `server.js` (the Express API)
   - `package.json` (dependencies)

### Step 2: Deploy to Render

1. Push your code to a GitHub repository
2. Go to https://render.com
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - **Name**: `nfib-scraper-api`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid for better performance)

6. Click "Create Web Service"

7. After deployment, note your service URL:
   `https://nfib-scraper-api.onrender.com`

---

## API Endpoints

### 1. Scrape Single Indicator

```
GET https://your-service.onrender.com/scrape?indicator=expand_good&months=1
```

**Parameters:**
- `indicator`: The indicator code (see list below)
- `months`: Number of recent months to return (default: 12)

**Response:**
```json
{
  "indicator": "expand_good",
  "data": [
    {
      "date": "2024/11/1",
      "value": 11.746
    }
  ],
  "scraped_at": "2024-12-01T10:30:00.000Z"
}
```

### 2. Scrape Multiple Indicators

```
POST https://your-service.onrender.com/scrape-multiple
Content-Type: application/json

{
  "indicators": ["expand_good", "OPT_INDEX", "bus_cond_expect"],
  "months": 3
}
```

### 3. Health Check

```
GET https://your-service.onrender.com/health
```

### 4. List Available Indicators

```
GET https://your-service.onrender.com/indicators
```

---

## Available Indicator Codes

| Code | Name |
|------|------|
| `OPT_INDEX` | Small Business Optimism Index |
| `emp_count_change_expect` | Plans to Increase Employment |
| `cap_ex_expect` | Plans to Make Capital Outlays |
| `inventory_expect` | Plans to Increase Inventories |
| `bus_cond_expect` | Expect Economy to Improve |
| `sales_expect` | Expect Real Sales Higher |
| `inventory_current` | Current Inventory |
| `job_opening_unfilled` | Current Job Openings |
| `credit_access_expect` | Expected Credit Conditions |
| `expand_good` | Now a Good Time to Expand |
| `earn_change` | Earnings Trends |
| `sales_change` | Actual Sales Changes |
| `price_change` | Actual Price Changes |
| `price_change_plan` | Price Plans |
| `emp_count_change` | Actual Employment Changes |
| `emp_comp_change` | Actual Compensation Changes |
| `emp_comp_change_expect` | Compensation Plans |
| `rate_change` | Relative Interest Rate |
| `inventory_change` | Actual Inventory Changes |
| `qualified_appl` | Qualified Applicants |
| `un_index` | Uncertainty Index |

---

## n8n Integration

### Simple Workflow: Get Latest Data for One Indicator

**Node 1: Schedule Trigger**
- Trigger: Second Tuesday of each month at 2 PM
- Cron: `0 14 8-14 * 2`

**Node 2: HTTP Request**
- Method: GET
- URL: `https://your-service.onrender.com/scrape?indicator=expand_good&months=1`

**Node 3: Code (Extract Value)**
```javascript
const data = $input.item.json.data[0];

return {
  json: {
    indicator: $input.item.json.indicator,
    date: data.date,
    value: data.value,
    scraped_at: $input.item.json.scraped_at
  }
};
```

**Node 4: Google Sheets (Append Row)**
- Columns:
  - Date: `={{$json.date}}`
  - Value: `={{$json.value}}`
  - Indicator: `={{$json.indicator}}`
  - Scraped At: `={{$json.scraped_at}}`

---

### Advanced Workflow: Get Multiple Indicators

**Node 1: Schedule Trigger** (same as above)

**Node 2: HTTP Request**
- Method: POST
- URL: `https://your-service.onrender.com/scrape-multiple`
- Body:
```json
{
  "indicators": [
    "OPT_INDEX",
    "expand_good",
    "bus_cond_expect",
    "sales_expect",
    "emp_count_change_expect"
  ],
  "months": 1
}
```

**Node 3: Code (Transform to Rows)**
```javascript
const results = [];
const response = $input.item.json;

// Iterate through each indicator
for (const [indicator, data] of Object.entries(response)) {
  if (data.data && data.data.length > 0) {
    const latest = data.data[data.data.length - 1];
    results.push({
      json: {
        indicator: indicator,
        date: latest.date,
        value: latest.value,
        scraped_at: data.scraped_at
      }
    });
  }
}

return results;
```

**Node 4: Google Sheets (Append Multiple Rows)**
- Iterate over the array from Node 3

---

## Local Testing

Before deploying, test locally:

```bash
# Install dependencies
npm install

# Test the scraper directly
npm test

# Start the server
npm start

# In another terminal, test the endpoint
curl "http://localhost:3000/scrape?indicator=expand_good&months=1"
```

---

## Important Notes

### Performance
- Each scrape takes 5-10 seconds (browser load + data render)
- For multiple indicators, requests are sequential
- Consider caching results if calling frequently

### Rate Limiting
- The NFIB site doesn't have explicit rate limits
- But be respectful - don't hammer the server
- Monthly updates are sufficient for this data

### Render.com Free Tier
- Service spins down after 15 minutes of inactivity
- First request after spindown will be slow (30-60 seconds)
- Upgrade to paid tier for always-on service

### Error Handling
- If the page structure changes, the scraper may break
- Monitor your n8n workflows for failures
- The health endpoint can be used for uptime monitoring

---

## Troubleshooting

**Problem**: "Chart not found" error
- **Solution**: The page structure changed. Update the selector in `nfib_puppeteer_scraper.js`

**Problem**: Timeout errors
- **Solution**: Increase the timeout values in the Puppeteer config

**Problem**: Service is slow
- **Solution**: Upgrade from Render's free tier, or optimize the scraper

**Problem**: Values don't match the website
- **Solution**: Verify the indicator code is correct, check the seasonal adjustment checkbox logic

---

## Alternative: Run Locally/Cron Job

If you don't want to use Render.com, you can:

1. Run the scraper as a cron job on your own server
2. Have it write directly to Google Sheets
3. Skip the API layer entirely

Example cron job script:
```javascript
const { scrapeNFIBIndicator } = require('./nfib_puppeteer_scraper');
const { GoogleSpreadsheet } = require('google-spreadsheet');

async function updateSheet() {
  const data = await scrapeNFIBIndicator('expand_good', 1);
  // ... write to Google Sheets
}

updateSheet();
```

---

## Summary

This solution:
✅ Gets the **exact** seasonally adjusted values from the page (11.746%, not 11%)
✅ Works with **all** indicator subcomponents
✅ Can be **automated** via n8n
✅ Is **reliable** (no guessing at seasonal adjustments)
✅ Can be **deployed** to Render.com alongside your n8n instance

The only downside is it requires running a headless browser, which adds complexity. But it's the only way to get the precise seasonally adjusted data that the page displays.
