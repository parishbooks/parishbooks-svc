import request from 'supertest';
import { gatewayHttpServer } from '../support/app';

describe('Gateway (e2e)', () => {
    it('GET /api returns 404 when no route is mounted at the root', () => request(gatewayHttpServer()).get('/api').expect(404));
});
