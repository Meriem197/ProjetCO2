const crypto = require('crypto');

function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const log = {
      level: res.statusCode >= 500 ? 'error' : 'info',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip
    };
    console.log(JSON.stringify(log));
  });

  next();
}

module.exports = {
  requestContext
};
