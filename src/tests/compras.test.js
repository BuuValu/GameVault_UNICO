jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/compras.repository');
jest.mock('../repositories/videojuegos.repository');
jest.mock('../repositories/usuarios.repository');

const request = require('supertest');
const app = require('../app');
const comprasRepo = require('../repositories/compras.repository');
const videojuegosRepo = require('../repositories/videojuegos.repository');
const usuariosRepo = require('../repositories/usuarios.repository');
const { tokens, videojuego, compra, errorMysql } = require('./helpers');

const pendiente = { ...compra, estado: 'pendiente' };

beforeEach(() => {
    jest.resetAllMocks();
});

describe('POST /api/compras', () => {
    test('éxito 201: usa el usuario del token y el precio del catálogo', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(null);
        comprasRepo.crear.mockResolvedValue(pendiente);

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1, precio_pagado: 0, id_usuario: 3 });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/compras/10');
        // El cliente no puede imponer ni el comprador ni el precio.
        expect(comprasRepo.crear).toHaveBeenCalledWith({
            idUsuario: 2,
            idVideojuego: 1,
            precio: 59.99
        });
    });

    test('éxito: reintento de una compra fallida reutiliza la fila', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue({ ...compra, estado: 'fallida' });
        comprasRepo.reintentar.mockResolvedValue(pendiente);

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1 });

        expect(res.status).toBe(201);
        expect(comprasRepo.reintentar).toHaveBeenCalledWith(10, 59.99);
        expect(comprasRepo.crear).not.toHaveBeenCalled();
    });

    test('error 401: sin token', async () => {
        const res = await request(app).post('/api/compras').send({ id_videojuego: 1 });
        expect(res.status).toBe(401);
    });

    test.each([
        ['falta id_videojuego', {}],
        ['id_videojuego como texto', { id_videojuego: '1' }],
        ['id_videojuego negativo', { id_videojuego: -4 }]
    ])('error 400: %s', async (_caso, cuerpo) => {
        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send(cuerpo);

        expect(res.status).toBe(400);
    });

    test('error 400: el videojuego no existe', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 99 });

        expect(res.status).toBe(400);
    });

    test('error 409: el videojuego está desactivado', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue({ ...videojuego, activo: false });

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1 });

        expect(res.status).toBe(409);
    });

    test('error 409: ya compró ese videojuego', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(compra);

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1 });

        expect(res.status).toBe(409);
        expect(comprasRepo.crear).not.toHaveBeenCalled();
    });

    test('error MySQL ER_DUP_ENTRY (doble clic simultáneo) → 409', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(null);
        comprasRepo.crear.mockRejectedValue(errorMysql('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1 });

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_NO_REFERENCED_ROW_2 (usuario del token ya no existe) → 400', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(null);
        comprasRepo.crear.mockRejectedValue(errorMysql('ER_NO_REFERENCED_ROW_2'));

        const res = await request(app)
            .post('/api/compras')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1 });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/compras (administrador)', () => {
    test('éxito: lista paginada con filtros', async () => {
        comprasRepo.listar.mockResolvedValue({ total: 1, compras: [compra] });

        const res = await request(app)
            .get('/api/compras?estado=confirmada&id_usuario=2')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(res.body.datos).toHaveLength(1);
        expect(comprasRepo.listar.mock.calls[0][0]).toMatchObject({
            estado: 'confirmada',
            idUsuario: 2
        });
    });

    test('error 403: un usuario normal no lista todas las compras', async () => {
        const res = await request(app).get('/api/compras').set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).get('/api/compras');
        expect(res.status).toBe(401);
    });

    test('error 400: estado desconocido', async () => {
        const res = await request(app)
            .get('/api/compras?estado=regalada')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/usuarios/:id/compras', () => {
    test('éxito: el usuario consulta sus propias compras', async () => {
        usuariosRepo.buscarPorId.mockResolvedValue({ id_usuario: 2 });
        comprasRepo.listar.mockResolvedValue({ total: 1, compras: [compra] });

        const res = await request(app)
            .get('/api/usuarios/2/compras')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(comprasRepo.listar.mock.calls[0][0].idUsuario).toBe(2);
    });

    test('éxito: un administrador consulta las de otro usuario', async () => {
        usuariosRepo.buscarPorId.mockResolvedValue({ id_usuario: 2 });
        comprasRepo.listar.mockResolvedValue({ total: 0, compras: [] });

        const res = await request(app)
            .get('/api/usuarios/2/compras')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 403: consultar las compras de otro usuario', async () => {
        const res = await request(app)
            .get('/api/usuarios/2/compras')
            .set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 404: el usuario no existe', async () => {
        usuariosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/usuarios/99/compras')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).get('/api/usuarios/2/compras');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/compras/:id', () => {
    test('éxito: el dueño ve su compra', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(compra);

        const res = await request(app).get('/api/compras/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(res.body.id_compra).toBe(10);
    });

    test('éxito: un administrador ve cualquier compra', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(compra);

        const res = await request(app).get('/api/compras/10').set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 403: otro usuario', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(compra);

        const res = await request(app).get('/api/compras/10').set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 404: no existe', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app).get('/api/compras/99').set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/compras/xyz').set('Authorization', tokens.admin);
        expect(res.status).toBe(400);
    });
});

describe('PATCH /api/compras/:id/estado (administrador)', () => {
    test('éxito: confirma una compra pendiente', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(pendiente);
        comprasRepo.cambiarEstado.mockResolvedValue({ ...pendiente, estado: 'confirmada' });

        const res = await request(app)
            .patch('/api/compras/10/estado')
            .set('Authorization', tokens.admin)
            .send({ estado: 'confirmada' });

        expect(res.status).toBe(200);
        expect(res.body.compra.estado).toBe('confirmada');
        expect(comprasRepo.cambiarEstado).toHaveBeenCalledWith(10, 'pendiente', 'confirmada');
    });

    test('éxito: marca una compra pendiente como fallida', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(pendiente);
        comprasRepo.cambiarEstado.mockResolvedValue({ ...pendiente, estado: 'fallida' });

        const res = await request(app)
            .patch('/api/compras/10/estado')
            .set('Authorization', tokens.admin)
            .send({ estado: 'fallida' });

        expect(res.status).toBe(200);
    });

    test('error 403: un usuario no confirma sus propios pagos', async () => {
        const res = await request(app)
            .patch('/api/compras/10/estado')
            .set('Authorization', tokens.ana)
            .send({ estado: 'confirmada' });

        expect(res.status).toBe(403);
    });

    test.each([
        ['estado inexistente', { estado: 'regalada' }],
        ['volver a pendiente', { estado: 'pendiente' }],
        ['sin estado', {}]
    ])('error 400: %s', async (_caso, cuerpo) => {
        const res = await request(app)
            .patch('/api/compras/10/estado')
            .set('Authorization', tokens.admin)
            .send(cuerpo);

        expect(res.status).toBe(400);
    });

    test('error 404: la compra no existe', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/compras/99/estado')
            .set('Authorization', tokens.admin)
            .send({ estado: 'confirmada' });

        expect(res.status).toBe(404);
    });

    test('error 409: la compra ya no está pendiente', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(compra);

        const res = await request(app)
            .patch('/api/compras/10/estado')
            .set('Authorization', tokens.admin)
            .send({ estado: 'fallida' });

        expect(res.status).toBe(409);
    });

    test('error 409: otra solicitud cambió el estado primero (concurrencia)', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(pendiente);
        comprasRepo.cambiarEstado.mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/compras/10/estado')
            .set('Authorization', tokens.admin)
            .send({ estado: 'confirmada' });

        expect(res.status).toBe(409);
    });
});

describe('DELETE /api/compras/:id (cancelar)', () => {
    test('éxito: el dueño cancela una compra pendiente', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(pendiente);
        comprasRepo.eliminarPendiente.mockResolvedValue(true);

        const res = await request(app).delete('/api/compras/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(comprasRepo.eliminarPendiente).toHaveBeenCalledWith(10);
    });

    test('error 409: no se cancela una compra confirmada', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(compra);

        const res = await request(app).delete('/api/compras/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(409);
        expect(comprasRepo.eliminarPendiente).not.toHaveBeenCalled();
    });

    test('error 403: otro usuario', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(pendiente);

        const res = await request(app).delete('/api/compras/10').set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 404: no existe', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app).delete('/api/compras/99').set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 409: se confirmó mientras se cancelaba (concurrencia)', async () => {
        comprasRepo.buscarPorId.mockResolvedValue(pendiente);
        comprasRepo.eliminarPendiente.mockResolvedValue(false);

        const res = await request(app).delete('/api/compras/10').set('Authorization', tokens.ana);

        expect(res.status).toBe(409);
    });
});
