const request = require('supertest');
const app = require('./server');

process.env.NODE_ENV = 'test';

describe('Hello Eyego App', () => {
  test('GET / should return Hello Eyego', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello Eyego');
  });

  test('GET /health should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});
