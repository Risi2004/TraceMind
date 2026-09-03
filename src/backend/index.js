import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import documentRoutes from './routes/document.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

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
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        profile: 'PUT /api/auth/profile',
        changePassword: 'PUT /api/auth/change-password',
      },
      documents: {
        upload: 'POST /api/documents/upload (supports PDF, DOCX, TXT, MD, ZIP)',
        list: 'GET /api/documents',
        viewUrl: 'GET /api/documents/:id/view-url',
        delete: 'DELETE /api/documents/:id',
      },
    },
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);


// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 TraceMind backend server is running on http://localhost:${PORT}`);
  console.log(`📡 Accepting client requests from: ${CLIENT_URL}`);
});

export default app;
