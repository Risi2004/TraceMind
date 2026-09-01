/**
 * Centralized global error handling middleware
 */
export const errorHandler = (err, req, res, _next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  // Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: 'DuplicateResource',
      message: `An account with this ${field} already exists.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: messages.join('. '),
    });
  }

  // Mongoose bad ObjectId CastError
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'InvalidId',
      message: `Resource not found with id: ${err.value}`,
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'InvalidToken',
      message: 'Invalid authentication token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'TokenExpired',
      message: 'Authentication token has expired.',
    });
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'ServerError',
    message: error.message || 'Internal Server Error',
  });
};
