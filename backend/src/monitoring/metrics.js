const metricsState = {
  startedAt: Date.now(),
  requestsTotal: 0,
  errorsTotal: 0
};

function metricsMiddleware(req, res, next) {
  metricsState.requestsTotal += 1;
  res.on('finish', () => {
    if (res.statusCode >= 500) metricsState.errorsTotal += 1;
  });
  next();
}

function getMetricsSnapshot() {
  return {
    uptimeSec: Math.round(process.uptime()),
    processStartedAt: new Date(metricsState.startedAt).toISOString(),
    requestsTotal: metricsState.requestsTotal,
    errorsTotal: metricsState.errorsTotal,
    memory: process.memoryUsage()
  };
}

module.exports = {
  metricsMiddleware,
  getMetricsSnapshot
};
