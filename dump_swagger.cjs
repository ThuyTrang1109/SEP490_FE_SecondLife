const http = require('http');
const fs = require('fs');

http.get('http://localhost:8080/v3/api-docs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const doc = JSON.parse(data);
    const endpoints = [];
    for (const [path, methods] of Object.entries(doc.paths || {})) {
      for (const [method, details] of Object.entries(methods)) {
        endpoints.push({
          method: method.toUpperCase(),
          path,
          summary: details.summary || '',
          tags: details.tags || [],
          parameters: (details.parameters || []).map(p => ({ name: p.name, in: p.in, required: p.required })),
          requestBody: details.requestBody ? true : false,
          responses: Object.keys(details.responses || {})
        });
      }
    }
    fs.writeFileSync('all_swagger_endpoints.json', JSON.stringify({ endpoints, components: doc.components }, null, 2));
    console.log('Total endpoints:', endpoints.length);
    endpoints.forEach(e => {
      console.log(e.method.padEnd(6) + ' ' + e.path.padEnd(50) + ' ' + JSON.stringify(e.tags) + ' - ' + e.summary);
    });
  });
}).on('error', err => console.error(err));
