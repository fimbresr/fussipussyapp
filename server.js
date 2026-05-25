const http = require('http');
const fs = require('fs');
const path = require('path');

// Cargar archivo .env de forma manual y segura (sin dependencias)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        } else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.warn('Error al cargar archivo .env:', e.message);
}

const PORT = 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle /api/analyze
  if (req.url === '/api/analyze' && req.method === 'POST') {
    if (!OPENAI_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API Key (OPENAI_API_KEY) no configurada en el servidor local. Ejecuta con: OPENAI_API_KEY=tu_clave node server.js' }));
      return;
    }

    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyStr);
        const { image } = body;

        if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Imagen inválida o faltante' }));
          return;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Revisión de moderación de contenido. Devuelve ESTRICTAMENTE JSON. Estructura: {"isSafe": boolean, "reason": string}. ¿Contiene la imagen material sexualmente explícito, desnudez o contenido altamente sugerente? Pon isSafe en false si hay contenido sexual, y justifica brevemente en español.'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: image }
                  }
                ]
              }
            ],
            max_tokens: 300,
            temperature: 0.1
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('OpenAI API error:', response.status, errText);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Error de OpenAI API (${response.status})` }));
          return;
        }

        const data = await response.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

      } catch (err) {
        console.error('Proxy server error:', err);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Error al contactar OpenAI API desde el servidor local' }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  
  // Guard against directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const startServer = (port) => {
  server.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(` Servidor local Fushipusyapp corriendo en:`);
    console.log(` http://localhost:${port}`);
    console.log(`==================================================\n`);
    if (!OPENAI_API_KEY) {
      console.warn(`⚠️  ADVERTENCIA: La variable de entorno OPENAI_API_KEY no está configurada.`);
      console.warn(`   Para que funcione, inicia el servidor como:`);
      console.warn(`   OPENAI_API_KEY=tu_clave node server.js\n`);
    } else {
      console.log(`   OPENAI_API_KEY cargada correctamente (largo: ${OPENAI_API_KEY.length})\n`);
    }
  });
};

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️  Puerto ${err.port} ocupado. Probando puerto ${err.port + 1}...`);
    startServer(err.port + 1);
  } else {
    console.error('Error del servidor:', err);
  }
});

startServer(PORT);
