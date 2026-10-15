jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/logros.repository');
jest.mock('../repositories/progreso.repository');
jest.mock('../repositories/videojuegos.repository');

const request = require('supertest');
const app = require('../app');
const logrosRepo = require('../repositories/logros.repository');
const progresoRepo = require('../repositories/progreso.repository');
const videojuegosRepo = require('../repositories/videojuegos.repository');
const { tokens, videojuego, logro, logroSimple, errorMysql } = require('./helpers');

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GET /api/videojuegos/:id/logros', () => {
    test('éxito: lista pública de logros del videojuego', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        logrosRepo.listarPorVideojuego.mockResolvedValue([logro, logroSimple]);

        const res = await request(app).get('/api/videojuegos/1/logros');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test('error 404: el videojuego no existe', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app).get('/api/videojuegos/99/logros');

        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/videojuegos/abc/logros');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/videojuegos/:id/logros', () => {
    function prepararCreacion() {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        logrosRepo.buscarPorNombre.mockResolvedValue(null);
    }

    test('éxito 201: logro de tipo progreso con meta', async () => {
        prepararCreacion();
        logrosRepo.crear.mockResolvedValue(logro);

        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'Coleccionista', descripcion: 'Reúne 10 objetos', tipo: 'progreso', meta: 10 });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/logros/7');
        expect(logrosRepo.crear).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ tipo: 'progreso', meta: 10 })
        );
    });

    test('éxito 201: sin tipo se asume "simple" y meta nula', async () => {
        prepararCreacion();
        logrosRepo.crear.mockResolvedValue(logroSimple);

        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'Primer paso', descripcion: 'Empieza el juego' });

        expect(res.status).toBe(201);
        expect(logrosRepo.crear.mock.calls[0][1]).toMatchObject({ tipo: 'simple', meta: null });
    });

    test('error 401: sin token', async () => {
        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .send({ nombre: 'X', descripcion: 'Y' });
        expect(res.status).toBe(401);
    });

    test('error 403: usuario normal', async () => {
        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .set('Authorization', tokens.ana)
            .send({ nombre: 'X', descripcion: 'Y' });
        expect(res.status).toBe(403);
    });

    test.each([
        ['sin nombre', { descripcion: 'Y' }],
        ['sin descripción', { nombre: 'X' }],
        ['tipo desconocido', { nombre: 'X', descripcion: 'Y', tipo: 'secreto' }],
        ['progreso sin meta', { nombre: 'X', descripcion: 'Y', tipo: 'progreso' }],
        ['meta cero', { nombre: 'X', descripcion: 'Y', tipo: 'progreso', meta: 0 }],
        ['meta decimal', { nombre: 'X', descripcion: 'Y', tipo: 'progreso', meta: 2.5 }],
        ['simple con meta', { nombre: 'X', descripcion: 'Y', tipo: 'simple', meta: 5 }],
        ['fecha con meta', { nombre: 'X', descripcion: 'Y', tipo: 'fecha', meta: 5 }]
    ])('error 400: %s', async (_caso, cuerpo) => {
        prepararCreacion();

        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .set('Authorization', tokens.admin)
            .send(cuerpo);

        expect(res.status).toBe(400);
        expect(logrosRepo.crear).not.toHaveBeenCalled();
    });

    test('error 404: el videojuego no existe', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/videojuegos/99/logros')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'X', descripcion: 'Y' });

        expect(res.status).toBe(404);
    });

    test('error 409: nombre repetido en el mismo videojuego', async () => {
        prepararCreacion();
        logrosRepo.buscarPorNombre.mockResolvedValue({ id_logro: 7 });

        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'Coleccionista', descripcion: 'Y' });

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_DUP_ENTRY (carrera) → 409', async () => {
        prepararCreacion();
        logrosRepo.crear.mockRejectedValue(errorMysql('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/videojuegos/1/logros')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'Coleccionista', descripcion: 'Y' });

        expect(res.status).toBe(409);
    });
});

describe('GET /api/logros/:id', () => {
    test('éxito', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);

        const res = await request(app).get('/api/logros/7');

        expect(res.status).toBe(200);
        expect(res.body.meta).toBe(10);
    });

    test('error 404', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(null);
        const res = await request(app).get('/api/logros/99');
        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/logros/siete');
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/logros/:id', () => {
    const cuerpoProgreso = {
        nombre: 'Coleccionista',
        descripcion: 'Nueva descripción',
        tipo: 'progreso',
        meta: 10
    };

    test('éxito: cambia la descripción aunque haya progreso registrado', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        logrosRepo.buscarPorNombre.mockResolvedValue({ id_logro: 7 });
        logrosRepo.actualizar.mockResolvedValue({ ...logro, descripcion: 'Nueva descripción' });

        const res = await request(app)
            .put('/api/logros/7')
            .set('Authorization', tokens.admin)
            .send(cuerpoProgreso);

        expect(res.status).toBe(200);
        // La condición no cambió: no hace falta consultar el progreso.
        expect(progresoRepo.contarPorLogro).not.toHaveBeenCalled();
    });

    test('éxito: cambia la meta si nadie tiene progreso todavía', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        logrosRepo.buscarPorNombre.mockResolvedValue({ id_logro: 7 });
        progresoRepo.contarPorLogro.mockResolvedValue(0);
        logrosRepo.actualizar.mockResolvedValue({ ...logro, meta: 20 });

        const res = await request(app)
            .put('/api/logros/7')
            .set('Authorization', tokens.admin)
            .send({ ...cuerpoProgreso, meta: 20 });

        expect(res.status).toBe(200);
    });

    test('error 409: cambiar la meta con progreso registrado', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        logrosRepo.buscarPorNombre.mockResolvedValue({ id_logro: 7 });
        progresoRepo.contarPorLogro.mockResolvedValue(3);

        const res = await request(app)
            .put('/api/logros/7')
            .set('Authorization', tokens.admin)
            .send({ ...cuerpoProgreso, meta: 20 });

        expect(res.status).toBe(409);
        expect(logrosRepo.actualizar).not.toHaveBeenCalled();
    });

    test('error 409: el nombre ya lo usa otro logro del videojuego', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        logrosRepo.buscarPorNombre.mockResolvedValue({ id_logro: 8 });

        const res = await request(app)
            .put('/api/logros/7')
            .set('Authorization', tokens.admin)
            .send(cuerpoProgreso);

        expect(res.status).toBe(409);
    });

    test('error 400: progreso sin meta', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);

        const res = await request(app)
            .put('/api/logros/7')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'X', descripcion: 'Y', tipo: 'progreso' });

        expect(res.status).toBe(400);
    });

    test('error 404: no existe', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/logros/99')
            .set('Authorization', tokens.admin)
            .send(cuerpoProgreso);

        expect(res.status).toBe(404);
    });

    test('error 403: usuario normal', async () => {
        const res = await request(app)
            .put('/api/logros/7')
            .set('Authorization', tokens.ana)
            .send(cuerpoProgreso);

        expect(res.status).toBe(403);
    });
});

describe('DELETE /api/logros/:id', () => {
    test('éxito', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        logrosRepo.eliminar.mockResolvedValue(true);

        const res = await request(app).delete('/api/logros/7').set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(logrosRepo.eliminar).toHaveBeenCalledWith(7);
    });

    test('error 404: no existe', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app).delete('/api/logros/99').set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 403: usuario normal', async () => {
        const res = await request(app).delete('/api/logros/7').set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).delete('/api/logros/7');
        expect(res.status).toBe(401);
    });
});
