// api/proxy.js
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { path } = req.query;
    const target = `https://dataserver-coids.inpe.br/${path}`;

    try {
        const response = await fetch(target, { cache: 'no-store' });
        const text = await response.text();
        res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
        res.status(response.status).send(text);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
}