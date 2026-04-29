const http  = require('http');
const https = require('https');

const PORT    = 3001;
const TARGET  = 'dataserver-coids.inpe.br';

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const options = {
    hostname: TARGET,
    path: req.url,
    method: 'GET',
  };

  const proxy = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    res.writeHead(500);
    res.end(`Erro no proxy: ${err.message}`);
  });

  req.pipe(proxy);
}).listen(PORT, () => {
  console.log(`Proxy rodando em http://localhost:${PORT}`);
});
