const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // to allow external port configuration

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

// Main API endpoint
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: 'Hello Eyego',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello Eyego App is running!',
    endpoints: {
      hello: '/api/hello',
      health: '/health'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
