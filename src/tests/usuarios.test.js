
const request = require('supertest');
const app = require('../app');

describe('API de usuarios', () => {
    test('GET /api/health responde 200 y confirma que la API funciona', async () => {
        const respuesta = await request(app).get('/api/health');

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.ok).toBe(true);
    });

    test('GET /api/usuarios/:id sin token responde 401', async () => {
        const respuesta = await request(app).get('/api/usuarios/1');

        expect(respuesta.status).toBe(401);
        expect(respuesta.body.mensaje).toBe(
            'Debes iniciar sesión para acceder a este recurso.'
        );
    });
});
