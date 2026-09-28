import request from 'supertest';
import { httpServer } from '../support/app';

describe('AppController (e2e)', () => {
    it('GET /api', () => request(httpServer()).get('/api').expect(200).expect({ message: 'Hello API' }));
});
