# NFIB Seasonally Adjusted Data Scraper

Scrapes seasonally adjusted NFIB indicator data from the NFIB website.

## Quick Start

```bash
npm install
npm start
```

Server runs on port 3000 (or `PORT` environment variable).

## API Usage

### Get Single Indicator

**Endpoint:** `GET /scrape?indicator=<code>&date=<optional>`

The API supports three modes:

#### 1. Get Specific Date
Get data for a specific date:
```bash
curl "http://localhost:3000/scrape?indicator=expand_good&date=10/1/2025"
```

**Response:**
```json
{
  "success": true,
  "indicator": "expand_good",
  "date": "10/1/2025",
  "value": "13.055908234097082",
  "scraped_at": "2025-11-30T07:58:05.604Z"
}
```

#### 2. Get Entire Time Series
Omit the `date` parameter to get all historical data:
```bash
curl "http://localhost:3000/scrape?indicator=expand_good"
```

**Response:**
```json
{
  "success": true,
  "indicator": "expand_good",
  "data": [
    { "date": "1/1/1986", "value": "20.43006555373382" },
    { "date": "2/1/1986", "value": "18.33024622842391" },
    ...
    { "date": "10/1/2025", "value": "13.055908234097082" }
  ],
  "count": 478,
  "scraped_at": "2025-11-30T07:58:05.604Z"
}
```

#### 3. Date Not Found
If you request a date that doesn't exist:
```json
{
  "success": false,
  "indicator": "expand_good",
  "date": "1/1/2030",
  "value": null,
  "error": "No data found for date: 1/1/2030",
  "scraped_at": "2025-11-30T08:00:00.544Z"
}
```

**Error Response (scraping failed):**
```json
{
  "success": false,
  "indicator": "INVALID_CODE",
  "date": null,
  "value": null,
  "error": "Failed to scrape NFIB data: Waiting failed: 40000ms exceeded",
  "error_type": "Error",
  "scraped_at": "2025-11-30T07:47:48.588Z"
}
```

## Available Indicators

Your 6 required indicators:
- `OPT_INDEX` - Small Business Optimism Index (~90 seconds)
- `expand_good` - Now a Good Time to Expand (~30 seconds)
- `emp_count_change_expect` - Plans to Increase Employment (~30 seconds)
- `inventory_expect` - Plans to Increase Inventories (~30 seconds)
- `bus_cond_expect` - Expect Economy to Improve (~30 seconds)
- `sales_expect` - Expect Real Sales Higher (~30 seconds)

See `/indicators` endpoint for full list of available indicators.

## Important: Memory Limitations on Render Free Tier

**⚠️ Critical:** Render's free tier has limited memory (512MB). Running Chromium is memory-intensive, so:

1. **Wait between requests:** Allow 60-90 seconds between scrape requests to let memory clear
2. **The service may crash** after 2-3 consecutive scrapes if requests come too quickly
3. **If you get 502 errors:** The service has crashed and needs to be manually restarted:
   - Go to Render dashboard → Your service → "Manual Deploy" → "Deploy latest commit"
4. **Recommended:** Upgrade to Render's paid tier ($7/month) for reliable operation with multiple requests

## n8n Integration

In n8n, create separate HTTP Request nodes for each indicator you need.

**IMPORTANT:** Add delays between requests to avoid memory crashes on Render's free tier.

### Option 1: Get Latest Value (Recommended for most use cases)
Add the date parameter for the most recent month:

**Example n8n workflow (with delays to prevent crashes):**
1. **HTTP Request node:** GET `https://your-app.onrender.com/scrape?indicator=OPT_INDEX&date=10/1/2025`
2. **Wait node:** 90 seconds
3. **HTTP Request node:** GET `https://your-app.onrender.com/scrape?indicator=expand_good&date=10/1/2025`
4. **Wait node:** 90 seconds
5. **HTTP Request node:** GET next indicator...
6. Repeat with 90-second waits between each indicator

### Option 2: Get Entire Time Series
Omit the date parameter to get all historical data (useful for backfilling or analysis):

1. **Method:** GET
2. **URL:** `https://your-app.onrender.com/scrape?indicator=OPT_INDEX`

### Option 3: Get Specific Historical Date
Add any date to get data from that specific month:

1. **Method:** GET
2. **URL:** `https://your-app.onrender.com/scrape?indicator=OPT_INDEX&date=1/1/2020`

**Benefits of this approach:**
- ✅ Each indicator request is independent
- ✅ If one fails, others still succeed
- ✅ Easy to see which specific indicator had an issue
- ✅ Can run them in parallel in n8n for faster results
- ✅ Flexible - get just what you need (single value vs entire series)

**Error Handling in n8n:**
Check the `success` field in the response. If `success: false`, the `error` field contains the error message.

## Response Times

- **OPT_INDEX**: ~90 seconds (slower per NFIB website)
- **Other indicators**: ~30-40 seconds each

## Other Endpoints

### Health Check
```bash
curl "http://localhost:3000/health"
```

### List All Available Indicators
```bash
curl "http://localhost:3000/indicators"
```

## Deployment to Render.com

The repository includes a `render.yaml` file that automatically configures everything needed for deployment.

### Steps:

1. **Push to GitHub** (already done)

2. **Create New Web Service on Render:**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `CBurgessTSU/nfib-scraper`

3. **Render will automatically:**
   - Detect the `render.yaml` configuration
   - Install Node.js 18
   - Run `npm install`
   - Install Chrome via Puppeteer
   - Start the server with `npm start`

4. **Wait for deployment** (~5-10 minutes for first deploy)
   - Chrome installation takes a few minutes
   - Render will show build logs

5. **Your API will be live at:**
   - `https://nfib-scraper.onrender.com` (or your custom name)

### Important Notes:

- **Free tier sleeps after inactivity** - First request after sleep takes ~30 seconds to wake up
- **Chrome download happens during build** - This is why first deploy takes longer
- **Subsequent deploys are faster** - Chrome is cached

## Notes

- The NFIB website can be slow to load data (10-90 seconds per indicator)
- Always check the `success` field in responses
- The scraper waits appropriately for the website to load data
- Returns the most recent month's seasonally adjusted value
