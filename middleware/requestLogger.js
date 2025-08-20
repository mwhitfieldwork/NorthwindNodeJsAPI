const requestLogger = (req, res, next) => {
    const start = Date.now();
    const originalSend = res.send;
  
    // Override res.send to capture response
    res.send = function(data) {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      };
  
      // Only log query params for GET requests
      if (req.method === 'GET' && Object.keys(req.query).length > 0) {
        logData.query = req.query;
      }
  
      // Log body for non-GET requests (but exclude sensitive data)
      if (req.method !== 'GET' && req.body) {
        const sanitizedBody = { ...req.body };
        // Remove sensitive fields
        delete sanitizedBody.password;
        delete sanitizedBody.token;
        logData.body = sanitizedBody;
      }
  
      // Color code based on status
      let color = '\x1b[0m'; // Reset
      if (res.statusCode >= 500) color = '\x1b[31m'; // Red
      else if (res.statusCode >= 400) color = '\x1b[33m'; // Yellow
      else if (res.statusCode >= 300) color = '\x1b[36m'; // Cyan
      else if (res.statusCode >= 200) color = '\x1b[32m'; // Green
  
      console.log(
        `${color}[${logData.timestamp}] ${logData.method} ${logData.url} - ${logData.statusCode} - ${logData.duration}\x1b[0m`
      );
  
      // In development, log more details for errors
      if (process.env.NODE_ENV === 'development' && res.statusCode >= 400) {
        console.log('Request details:', JSON.stringify(logData, null, 2));
      }
  
      originalSend.call(this, data);
    };
  
    next();
  };
  
  module.exports = requestLogger;