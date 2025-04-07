const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const OLLAMA_API_URL = 'http://192.168.2.74:4444';

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
    let data = [];
    req.on('data', chunk => {
      data.push(chunk);
    });

    req.on('end', () => {
      // Maintain the /api prefix when forwarding to Ollama
      const apiPath = pathname;
      
      const options = {
        hostname: url.parse(OLLAMA_API_URL).hostname,
        port: url.parse(OLLAMA_API_URL).port || 80,
        path: apiPath,  // Keep the /api prefix
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      console.log(`Proxying request to: ${OLLAMA_API_URL}${apiPath}`);

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
  console.log(`Proxying requests to Ollama API at ${OLLAMA_API_URL}`);
});