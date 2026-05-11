import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

const {
    VITE_PORT,
} = process.env;

const PORT = Number(process.env.PORT) || Number(VITE_PORT) || 8000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Spotify API proxy server running on http://localhost:${PORT}`);
}).on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try another port.`);
        process.exit(1);
    }
});
