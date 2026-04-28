import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8000;
const SPOTIFY_PROXY_ROUTE = process.env.SPOTIFY_PROXY_ROUTE;
const SPOTIFY_AUDIO_FEATURES_ROUTE = process.env.SPOTIFY_AUDIO_FEATURES_ROUTE;
const SPOTIFY_ARTISTS_ROUTE = process.env.SPOTIFY_ARTISTS_ROUTE;
const SPOTIFY_AUDIO_FEATURES_URL = process.env.SPOTIFY_AUDIO_FEATURES_URL;
const SPOTIFY_ARTISTS_URL = process.env.SPOTIFY_ARTISTS_URL;

if (
    !SPOTIFY_PROXY_ROUTE ||
    !SPOTIFY_AUDIO_FEATURES_ROUTE ||
    !SPOTIFY_ARTISTS_ROUTE ||
    !SPOTIFY_AUDIO_FEATURES_URL ||
    !SPOTIFY_ARTISTS_URL
) {
    throw new Error('Missing Spotify endpoint configuration in environment');
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

/**
 * Generic Spotify API proxy endpoint
 * Forwards requests to Spotify API with the access token
 */
app.post(SPOTIFY_PROXY_ROUTE, async (req, res) => {
    try {
        const { url, method = 'GET', data, accessToken } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        if (!accessToken) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        // For GET requests with data, append as query parameters
        let finalUrl = url;
        if (data && method === 'GET') {
            const params = new URLSearchParams(data);
            finalUrl = `${url}?${params.toString()}`;
        }

        const response = await fetch(finalUrl, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Spotify API error (${response.status}):`, errorData);
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) res.set('Retry-After', retryAfter);
            return res.status(response.status).json(errorData);
        }

        const responseData = await response.json();
        res.json(responseData);
    } catch (error) {
        console.error('Spotify API proxy fatal error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Specific endpoint for audio features (handles large ID lists)
 */
app.get(SPOTIFY_AUDIO_FEATURES_ROUTE, async (req, res) => {
    try {
        const { ids, accessToken } = req.query;

        if (!ids) {
            return res.status(400).json({ error: 'IDs are required' });
        }

        if (!accessToken) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        const url = `${SPOTIFY_AUDIO_FEATURES_URL}?ids=${ids}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Audio features proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Specific endpoint for artists (handles large ID lists)
 */
app.get(SPOTIFY_ARTISTS_ROUTE, async (req, res) => {
    try {
        const { ids, accessToken } = req.query;

        if (!ids) {
            return res.status(400).json({ error: 'IDs are required' });
        }

        if (!accessToken) {
            return res.status(401).json({ error: 'Access token is required' });
        }

        const url = `${SPOTIFY_ARTISTS_URL}?ids=${ids}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Artists proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Spotify API proxy server running on http://localhost:${PORT}`);
}).on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try another port.`);
        process.exit(1);
    }
});
