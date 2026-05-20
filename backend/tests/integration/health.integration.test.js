const request = require('supertest');
const { app } = require('../../server');

describe('integration: observability endpoints', () => {
  test('GET /health returns service status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.mqtt).toBeDefined();
  });

  test('GET /metrics returns runtime counters', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requestsTotal).toBeGreaterThan(0);
    expect(res.body.data.memory).toBeDefined();
  });
});
