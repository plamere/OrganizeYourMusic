export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, method = 'GET', data, accessToken } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is required' });
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    let finalUrl = url;
    if (data && method === 'GET') {
      const params = new URLSearchParams(data);
      finalUrl = `${url}?${params.toString()}`;
    } else if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(finalUrl, options);
    const text = await response.text();
    
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (parseError) {
      // If response is not JSON, create an error object
      payload = {
        error: {
          message: text || `HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error('Spotify API proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}