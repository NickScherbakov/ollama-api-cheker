const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
// Удаляем статический импорт open

const PORT = 3000;
// Значение по умолчанию, которое можно переопределить через параметр запроса
const DEFAULT_OLLAMA_API_URL = 'http://localhost:11434';

const server = http.createServer((req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests (preflight CORS requests)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve the HTML file for root requests
  if (pathname === '/' || pathname === '/index.html') {
    const filePath = path.join(__dirname, 'ollama-test.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading the HTML file');
        return;
      }
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(data);
    });
    return;
  }

  // Proxy API requests to Ollama server
  if (pathname.startsWith('/api/')) {
    // Получаем URL Ollama API из параметра запроса или используем значение по умолчанию
    const ollamaApiUrl = parsedUrl.query.apiUrl || DEFAULT_OLLAMA_API_URL;
    
    let data = [];
    req.on('data', chunk => {
      data.push(chunk);
    });

    req.on('end', () => {
      // Maintain the /api prefix when forwarding to Ollama
      const apiPath = pathname;
      
      const options = {
        hostname: url.parse(ollamaApiUrl).hostname,
        port: url.parse(ollamaApiUrl).port || 80,
        path: apiPath,  // Keep the /api prefix
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      console.log(`Proxying request to: ${ollamaApiUrl}${apiPath}`);

      const proxyReq = http.request(options, proxyRes => {
        // Special handling for generate endpoint which returns streaming JSON
        if (pathname === '/api/generate') {
          let fullResponse = '';
          let combinedResponse = '';
          
          proxyRes.on('data', (chunk) => {
            const chunkStr = chunk.toString();
            fullResponse += chunkStr;
            
            // Try to parse each line as it comes in
            try {
              const lines = chunkStr.split('\n').filter(line => line.trim());
              for (const line of lines) {
                const parsed = JSON.parse(line);
                if (parsed.response) {
                  combinedResponse += parsed.response;
                }
              }
            } catch (e) {
              // Ignore parsing errors for partial chunks
            }
          });
          
          proxyRes.on('end', () => {
            try {
              console.log("Finished processing streaming response");
              
              // Create a final response object with the combined text
              const responseObj = {
                response: combinedResponse,
                done: true
              };
              
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify(responseObj));
              
              console.log("Sent final response:", JSON.stringify(responseObj).substring(0, 100) + "...");
            } catch (error) {
              console.error('Error processing streaming response:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to process streaming response' }));
            }
          });
        }
        // For JSON responses (non-streaming)
        else if (proxyRes.headers['content-type'] && 
            proxyRes.headers['content-type'].includes('application/json')) {
          
          let responseData = '';
          
          proxyRes.on('data', (chunk) => {
            responseData += chunk.toString();
          });
          
          proxyRes.on('end', () => {
            try {
              // Try to parse as JSON to validate it
              JSON.parse(responseData);
              
              // Send back to client with proper headers
              res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(responseData);
            } catch (error) {
              console.error('Error parsing JSON response:', error);
              console.error('Response data:', responseData);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Invalid JSON response from API server' }));
            }
          });
        } else {
          // For non-JSON responses, simply pipe the response
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', (error) => {
        console.error('Error proxying request:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to connect to Ollama API' }));
      });

      if (data.length > 0) {
        proxyReq.write(Buffer.concat(data));
      }
      
      proxyReq.end();
    });
    return;
  }

  // Handle 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
  console.log(`Default Ollama API URL: ${DEFAULT_OLLAMA_API_URL}`);
  
  // Используем динамический импорт
  (async () => {
    try {
      const open = await import('open');
      // Открываем браузер по умолчанию с URL нашего приложения
      console.log('Opening browser...');
      await open.default(`http://localhost:${PORT}`);
    } catch (error) {
      console.error('Failed to open browser:', error);
    }
  })();
});