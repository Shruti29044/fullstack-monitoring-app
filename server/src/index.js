import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import client from 'prom-client';

dotenv.config();
// Also load env.local from project root robustly (handles different CWDs)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../env.local');
dotenv.config({ path: rootEnvPath, override: false });

const app = express();
app.use(cors());
app.use(express.json());

const serverPort = process.env.PORT || 3001;
const yelpApiKey = process.env.YELP_API_KEY;

const yelpClient = axios.create({
    baseURL: 'https://api.yelp.com/v3',
    timeout: 15000,
    headers: yelpApiKey ? { Authorization: `Bearer ${yelpApiKey}` } : {},
});

// Metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
    name: 'api_request_duration_seconds',
    help: 'Duration of API requests in seconds',
    labelNames: ['route', 'method', 'status'],
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});
register.registerMetric(httpRequestDuration);

app.get('/metrics', async (_req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).send('metrics unavailable');
    }
});

function ensureYelpKeyPresent() {
    if (!yelpApiKey) {
        const error = new Error('YELP_API_KEY is not configured');
        error.statusCode = 500;
        throw error;
    }
}

function buildRatingsHistogram(businesses) {
    const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const business of businesses) {
        if (typeof business.rating !== 'number') continue;
        const rounded = Math.round(business.rating);
        if (histogram[rounded] !== undefined) histogram[rounded] += 1;
    }
    return histogram;
}

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/yelp/search', async (req, res) => {
    const endTimer = httpRequestDuration.startTimer({ route: 'yelp_search', method: 'GET' });
    try {
        ensureYelpKeyPresent();

        const term = req.query.term || 'CVS Pharmacy';
        const location = req.query.location || 'San Francisco, CA';
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        const price = req.query.price; // e.g., '1,2,3'
        const sort_by = req.query.sort_by; // 'rating' | 'review_count' | 'best_match'

        const response = await yelpClient.get('/businesses/search', {
            params: { term, location, limit, offset, price, sort_by },
        });

        res.json({
            total: response.data.total,
            businesses:
                response.data.businesses?.map((b) => ({
                    id: b.id,
                    name: b.name,
                    rating: b.rating,
                    review_count: b.review_count,
                    price: b.price,
                    phone: b.display_phone,
                    url: b.url,
                    coordinates: b.coordinates,
                    location: b.location,
                })) || [],
        });
        endTimer({ status: 200 });
    } catch (err) {
        const status = err.statusCode || err.response?.status || 500;
        endTimer({ status });
        res.status(status).json({ error: err.message || 'Search failed' });
    }
});

app.get('/api/yelp/business/:id/reviews', async (req, res) => {
    const endTimer = httpRequestDuration.startTimer({ route: 'yelp_reviews', method: 'GET' });
    try {
        ensureYelpKeyPresent();
        const businessId = req.params.id;
        const response = await yelpClient.get(`/businesses/${businessId}/reviews`);
        const reviews = (response.data.reviews || []).map((r) => ({
            id: r.id,
            rating: r.rating,
            text: r.text,
            time_created: r.time_created,
            url: r.url,
            user: { name: r.user?.name, image_url: r.user?.image_url },
        }));
        res.json({ reviews });
        endTimer({ status: 200 });
    } catch (err) {
        const status = err.statusCode || err.response?.status || 500;
        endTimer({ status });
        res.status(status).json({ error: err.message || 'Fetching reviews failed' });
    }
});

app.get('/api/yelp/cvs/ratings-histogram', async (req, res) => {
    const endTimer = httpRequestDuration.startTimer({ route: 'yelp_histogram', method: 'GET' });
    try {
        ensureYelpKeyPresent();
        const location = req.query.location || 'San Francisco, CA';
        const term = req.query.term || 'CVS Pharmacy';
        const limit = Math.min(Number(req.query.limit) || 50, 50);
        const response = await yelpClient.get('/businesses/search', {
            params: { term, location, limit },
        });
        const businesses = response.data.businesses || [];
        const histogram = buildRatingsHistogram(businesses);
        res.json({ location, term, count: businesses.length, histogram });
        endTimer({ status: 200 });
    } catch (err) {
        const status = err.statusCode || err.response?.status || 500;
        endTimer({ status });
        res.status(status).json({ error: err.message || 'Histogram failed' });
    }
});

// Business details
app.get('/api/yelp/business/:id', async (req, res) => {
    const endTimer = httpRequestDuration.startTimer({ route: 'yelp_business', method: 'GET' });
    try {
        ensureYelpKeyPresent();
        const businessId = req.params.id;
        const response = await yelpClient.get(`/businesses/${businessId}`);
        const b = response.data || {};
        res.json({
            id: b.id,
            name: b.name,
            rating: b.rating,
            review_count: b.review_count,
            price: b.price,
            phone: b.display_phone,
            url: b.url,
            coordinates: b.coordinates,
            location: b.location,
            hours: b.hours,
            categories: b.categories,
            photos: b.photos,
        });
        endTimer({ status: 200 });
    } catch (err) {
        const status = err.statusCode || err.response?.status || 500;
        endTimer({ status });
        res.status(status).json({ error: err.message || 'Business details failed' });
    }
});

app.listen(serverPort, () => {
    console.log(`API listening on http://localhost:${serverPort}`);
});


