import request from 'supertest';
import { httpServer } from '../support/app';

describe('Gateway (e2e)', () => {
    it('GET /api returns 404 when no route is mounted at the root', () => request(httpServer()).get('/api').expect(404));
});
