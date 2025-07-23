const request = require('supertest');
const app = require('./server');

describe('Hello Eyego App', () => {
  test('GET / should return app info', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello Eyego App is running!');
  });

  test('GET /api/hello should return Hello Eyego', async () => {
    const response = await request(app).get('/api/hello');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello Eyego');
    expect(response.body.version).toBe('1.0.0');
  });

  test('GET /health should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});
