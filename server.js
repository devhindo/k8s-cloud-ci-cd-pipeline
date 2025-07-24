const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Main API endpoint - returns Hello Eyego
app.get('/', (req, res) => {
  res.send('Hello Eyego');
});

// Health check endpoint (required for Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start server (only if not in test environment)
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  if (server) {
    server.close(() => process.exit(0));
  }
});

process.on('SIGINT', () => {
  if (server) {
    server.close(() => process.exit(0));
  }
});

module.exports = app;
