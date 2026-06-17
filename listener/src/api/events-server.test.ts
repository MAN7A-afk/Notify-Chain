import http from 'http';
import { createEventsServer } from './events-server';
import { preferenceStore } from '../store/preference-store';

jest.mock('../store/preference-store', () => {
  const store = {
    get: jest.fn(),
    update: jest.fn(),
    isCategoryEnabled: jest.fn(),
  };
  return { preferenceStore: store };
});

jest.mock('../store/event-registry', () => ({
  eventRegistry: { getEvents: jest.fn(() => []), count: jest.fn(() => 0) },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockStore = preferenceStore as jest.Mocked<typeof preferenceStore>;

function request(
  server: http.Server,
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as { port: number }).port;
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method,
        headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(data) }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('Preference API endpoints', () => {
  let server: http.Server;

  beforeEach((done) => {
    jest.clearAllMocks();
    server = createEventsServer({ port: 0 });
    server.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    server.close(done);
  });

  describe('GET /api/preferences/:userId', () => {
    it('returns preferences for the given user', async () => {
      const prefs = { userId: 'alice', categories: { discord: true }, updatedAt: 1000 };
      mockStore.get.mockReturnValue(prefs);

      const res = await request(server, 'GET', '/api/preferences/alice');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(prefs);
      expect(mockStore.get).toHaveBeenCalledWith('alice');
    });
  });

  describe('PUT /api/preferences/:userId', () => {
    it('updates and returns preferences', async () => {
      const updated = { userId: 'alice', categories: { discord: false }, updatedAt: 2000 };
      mockStore.update.mockReturnValue(updated);

      const res = await request(server, 'PUT', '/api/preferences/alice', {
        categories: { discord: false },
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updated);
      expect(mockStore.update).toHaveBeenCalledWith('alice', { categories: { discord: false } });
    });

    it('returns 400 for invalid JSON body', async () => {
      const port = (server.address() as { port: number }).port;
      const res = await new Promise<{ status: number }>((resolve, reject) => {
        const req = http.request(
          { hostname: '127.0.0.1', port, path: '/api/preferences/alice', method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Content-Length': 8 } },
          (r) => {
            r.resume();
            r.on('end', () => resolve({ status: r.statusCode! }));
          }
        );
        req.on('error', reject);
        req.write('not-json');
        req.end();
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when categories field is missing', async () => {
      const res = await request(server, 'PUT', '/api/preferences/alice', { foo: 'bar' });
      expect(res.status).toBe(400);
    });
  });

  describe('unknown routes', () => {
    it('returns 404 for unrecognised paths', async () => {
      const res = await request(server, 'GET', '/api/unknown');
      expect(res.status).toBe(404);
    });
  });
});
