import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middlewares
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TraceMind Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root API info
app.get('/api', (req, res) => {
  res.json({
    name: 'TraceMind API',
    version: '1.0.0',
    description: 'TraceMind AI Innovation Challenge Backend Service',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 TraceMind backend server is running on http://localhost:${PORT}`);
  console.log(`📡 Accepting client requests from: ${CLIENT_URL}`);
});

export default app;
