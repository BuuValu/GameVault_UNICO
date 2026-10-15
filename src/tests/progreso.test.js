jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/progreso.repository');
jest.mock('../repositories/logros.repository');
jest.mock('../repositories/compras.repository');
jest.mock('../repositories/usuarios.repository');

const request = require('supertest');
const app = require('../app');
const progresoRepo = require('../repositories/progreso.repository');
const logrosRepo = require('../repositories/logros.repository');
const comprasRepo = require('../repositories/compras.repository');
const usuariosRepo = require('../repositories/usuarios.repository');
const { tokens, compra, logro, logroSimple, errorMysql } = require('./helpers');

const FECHA = '2026-10-05T12:00:00.000Z';

const enCurso = {
    id_usuario: 2,
    id_logro: 7,
    progreso: 4,
    desbloqueado: false,
    fecha_desbloqueo: null,
    id_videojuego: 1,
    logro_nombre: 'Coleccionista',
    tipo: 'progreso',
    meta: 10
};

const completado = { ...enCurso, progreso: 10, desbloqueado: true, fecha_desbloqueo: FECHA };

beforeEach(() => {
    jest.resetAllMocks();
    usuariosRepo.buscarPorId.mockResolvedValue({ id_usuario: 2 });
});

describe('PUT /api/usuarios/:id/logros/:idLogro', () => {
    function prepararRegistro(logroActual = logro, progresoActual = null) {
        logrosRepo.buscarPorId.mockResolvedValue(logroActual);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(compra);
        progresoRepo.buscar.mockResolvedValue(progresoActual);
        progresoRepo.guardar.mockImplementation(async (datos) => ({
            ...enCurso,
            progreso: datos.progreso,
            desbloqueado: datos.desbloqueado,
            fecha_desbloqueo: datos.fechaDesbloqueo
        }));
    }

    test('éxito 201: primer avance parcial (sin desbloquear)', async () => {
        prepararRegistro();

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 4 });

        expect(res.status).toBe(201);
        expect(progresoRepo.guardar).toHaveBeenCalledWith(
            expect.objectContaining({ progreso: 4, desbloqueado: false, fechaDesbloqueo: null })
        );
    });

    test('éxito 200: al alcanzar la meta se desbloquea y se fija la fecha', async () => {
        prepararRegistro(logro, enCurso);

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 10 });

        expect(res.status).toBe(200);
        const guardado = progresoRepo.guardar.mock.calls[0][0];
        expect(guardado.desbloqueado).toBe(true);
        expect(guardado.fechaDesbloqueo).toBeInstanceOf(Date);
    });

    test('éxito: repetir el PUT conserva la fecha de desbloqueo original', async () => {
        prepararRegistro(logro, completado);

        await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 10 });

        expect(progresoRepo.guardar.mock.calls[0][0].fechaDesbloqueo).toBe(FECHA);
    });

    test('éxito: un logro simple se desbloquea con progreso = 1', async () => {
        prepararRegistro(logroSimple);

        const res = await request(app)
            .put('/api/usuarios/2/logros/8')
            .set('Authorization', tokens.ana)
            .send({ progreso: 1 });

        expect(res.status).toBe(201);
        expect(progresoRepo.guardar.mock.calls[0][0].desbloqueado).toBe(true);
    });

    test('éxito: un administrador registra progreso de otro usuario', async () => {
        prepararRegistro();

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.admin)
            .send({ progreso: 2 });

        expect(res.status).toBe(201);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).put('/api/usuarios/2/logros/7').send({ progreso: 1 });
        expect(res.status).toBe(401);
    });

    test('error 403: avanzar en el logro de otro usuario', async () => {
        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.beto)
            .send({ progreso: 1 });

        expect(res.status).toBe(403);
    });

    test.each([
        ['negativo', { progreso: -1 }],
        ['decimal', { progreso: 2.5 }],
        ['texto', { progreso: '3' }],
        ['ausente', {}]
    ])('error 400: progreso %s', async (_caso, cuerpo) => {
        prepararRegistro();

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send(cuerpo);

        expect(res.status).toBe(400);
        expect(progresoRepo.guardar).not.toHaveBeenCalled();
    });

    test('error 400: el progreso supera la meta', async () => {
        prepararRegistro();

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 11 });

        expect(res.status).toBe(400);
    });

    test('error 400: un logro simple no admite progreso mayor que 1', async () => {
        prepararRegistro(logroSimple);

        const res = await request(app)
            .put('/api/usuarios/2/logros/8')
            .set('Authorization', tokens.ana)
            .send({ progreso: 3 });

        expect(res.status).toBe(400);
    });

    test('error 403: no tiene el videojuego comprado', async () => {
        prepararRegistro();
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 1 });

        expect(res.status).toBe(403);
    });

    test('error 403: la compra aún está pendiente', async () => {
        prepararRegistro();
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue({ ...compra, estado: 'pendiente' });

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 1 });

        expect(res.status).toBe(403);
    });

    test('error 409: el progreso no puede retroceder', async () => {
        prepararRegistro(logro, enCurso);

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 2 });

        expect(res.status).toBe(409);
        expect(progresoRepo.guardar).not.toHaveBeenCalled();
    });

    test('error 404: el logro no existe', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/usuarios/2/logros/99')
            .set('Authorization', tokens.ana)
            .send({ progreso: 1 });

        expect(res.status).toBe(404);
    });

    test('error 404: el usuario no existe (administrador)', async () => {
        usuariosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/usuarios/99/logros/7')
            .set('Authorization', tokens.admin)
            .send({ progreso: 1 });

        expect(res.status).toBe(404);
    });

    test('error MySQL ER_NO_REFERENCED_ROW_2 → 400', async () => {
        prepararRegistro();
        progresoRepo.guardar.mockRejectedValue(errorMysql('ER_NO_REFERENCED_ROW_2'));

        const res = await request(app)
            .put('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana)
            .send({ progreso: 1 });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/usuarios/:id/logros', () => {
    test('éxito: lista el progreso del usuario', async () => {
        progresoRepo.listarPorUsuario.mockResolvedValue([enCurso, completado]);

        const res = await request(app)
            .get('/api/usuarios/2/logros')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(progresoRepo.listarPorUsuario).toHaveBeenCalledWith(2, undefined);
    });

    test('éxito: filtra por videojuego', async () => {
        progresoRepo.listarPorUsuario.mockResolvedValue([enCurso]);

        const res = await request(app)
            .get('/api/usuarios/2/logros?id_videojuego=1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(progresoRepo.listarPorUsuario).toHaveBeenCalledWith(2, 1);
    });

    test('error 403: otro usuario', async () => {
        const res = await request(app)
            .get('/api/usuarios/2/logros')
            .set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).get('/api/usuarios/2/logros');
        expect(res.status).toBe(401);
    });

    test('error 400: id_videojuego inválido', async () => {
        const res = await request(app)
            .get('/api/usuarios/2/logros?id_videojuego=abc')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/usuarios/:id/logros/:idLogro', () => {
    test('éxito', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        progresoRepo.buscar.mockResolvedValue(enCurso);

        const res = await request(app)
            .get('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(res.body.progreso).toBe(4);
    });

    test('error 404: todavía no hay progreso registrado', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(logro);
        progresoRepo.buscar.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 404: el logro no existe', async () => {
        logrosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/usuarios/2/logros/99')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/usuarios/:id/logros/:idLogro', () => {
    test('éxito: reinicia el progreso', async () => {
        progresoRepo.eliminar.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(progresoRepo.eliminar).toHaveBeenCalledWith(2, 7);
    });

    test('error 404: no había progreso', async () => {
        progresoRepo.eliminar.mockResolvedValue(false);

        const res = await request(app)
            .delete('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 403: otro usuario', async () => {
        const res = await request(app)
            .delete('/api/usuarios/2/logros/7')
            .set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
    });
});
