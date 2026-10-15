jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/resenas.repository');
jest.mock('../repositories/compras.repository');
jest.mock('../repositories/videojuegos.repository');
jest.mock('../repositories/etiquetas.repository');

const request = require('supertest');
const app = require('../app');
const resenasRepo = require('../repositories/resenas.repository');
const comprasRepo = require('../repositories/compras.repository');
const videojuegosRepo = require('../repositories/videojuegos.repository');
const etiquetasRepo = require('../repositories/etiquetas.repository');
const { tokens, videojuego, compra, resena, errorMysql } = require('./helpers');

const cuerpoValido = {
    id_videojuego: 1,
    calificacion: 4,
    comentario: 'Muy bueno',
    horas_jugadas: 12.5,
    etiquetas: [1]
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('POST /api/resenas', () => {
    function prepararCreacion() {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        etiquetasRepo.idsExistentes.mockResolvedValue([1]);
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(compra);
        resenasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(null);
        resenasRepo.crear.mockResolvedValue(resena);
    }

    test('éxito 201: reseña con etiquetas; el autor sale del token', async () => {
        prepararCreacion();

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send({ ...cuerpoValido, id_usuario: 3 });

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/resenas/5');
        expect(resenasRepo.crear).toHaveBeenCalledWith(
            expect.objectContaining({ id_usuario: 2, id_videojuego: 1, calificacion: 4 }),
            [1]
        );
    });

    test('éxito: solo la calificación es obligatoria', async () => {
        prepararCreacion();

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send({ id_videojuego: 1, calificacion: 5 });

        expect(res.status).toBe(201);
        expect(resenasRepo.crear).toHaveBeenCalledWith(
            expect.objectContaining({ comentario: null, horas_jugadas: null }),
            []
        );
    });

    test('error 401: sin token', async () => {
        const res = await request(app).post('/api/resenas').send(cuerpoValido);
        expect(res.status).toBe(401);
    });

    test.each([
        ['calificación 0', { calificacion: 0 }],
        ['calificación 6', { calificacion: 6 }],
        ['calificación decimal', { calificacion: 4.5 }],
        ['calificación como texto', { calificacion: '5' }],
        ['sin calificación', { calificacion: undefined }],
        ['horas negativas', { horas_jugadas: -1 }],
        ['horas como texto', { horas_jugadas: 'muchas' }],
        ['comentario demasiado largo', { comentario: 'x'.repeat(2001) }],
        ['etiquetas no es arreglo', { etiquetas: 'divertido' }],
        ['más de 10 etiquetas', { etiquetas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }],
        ['sin id_videojuego', { id_videojuego: undefined }]
    ])('error 400: %s', async (_caso, cambio) => {
        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send({ ...cuerpoValido, ...cambio });

        expect(res.status).toBe(400);
        expect(resenasRepo.crear).not.toHaveBeenCalled();
    });

    test('error 400: etiqueta inexistente', async () => {
        prepararCreacion();
        etiquetasRepo.idsExistentes.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send({ ...cuerpoValido, etiquetas: [99] });

        expect(res.status).toBe(400);
    });

    test('error 400: el videojuego no existe', async () => {
        prepararCreacion();
        videojuegosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send(cuerpoValido);

        expect(res.status).toBe(400);
    });

    test('error 403: nunca compró el videojuego', async () => {
        prepararCreacion();
        comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send(cuerpoValido);

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('comprar');
    });

    test.each(['pendiente', 'fallida'])(
        'error 403: la compra está %s (debe estar confirmada)',
        async (estado) => {
            prepararCreacion();
            comprasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue({ ...compra, estado });

            const res = await request(app)
                .post('/api/resenas')
                .set('Authorization', tokens.ana)
                .send(cuerpoValido);

            expect(res.status).toBe(403);
        }
    );

    test('error 409: ya reseñó ese videojuego', async () => {
        prepararCreacion();
        resenasRepo.buscarPorUsuarioYVideojuego.mockResolvedValue({ id_resena: 5 });

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send(cuerpoValido);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_DUP_ENTRY (dos reseñas simultáneas) → 409', async () => {
        prepararCreacion();
        resenasRepo.crear.mockRejectedValue(errorMysql('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send(cuerpoValido);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_CHECK_CONSTRAINT_VIOLATED → 400', async () => {
        prepararCreacion();
        resenasRepo.crear.mockRejectedValue(errorMysql('ER_CHECK_CONSTRAINT_VIOLATED'));

        const res = await request(app)
            .post('/api/resenas')
            .set('Authorization', tokens.ana)
            .send(cuerpoValido);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/resenas', () => {
    test('éxito: lista pública paginada con filtros', async () => {
        resenasRepo.listar.mockResolvedValue({ total: 1, resenas: [resena] });

        const res = await request(app).get(
            '/api/resenas?id_videojuego=1&calificacion=4&id_usuario=2&pagina=1&limite=10'
        );

        expect(res.status).toBe(200);
        expect(res.body.datos).toHaveLength(1);
        expect(res.body.datos[0]).not.toHaveProperty('correo');
        expect(resenasRepo.listar.mock.calls[0][0]).toMatchObject({
            idVideojuego: 1,
            calificacion: 4,
            idUsuario: 2,
            limite: 10
        });
    });

    test('error 400: calificación fuera de rango', async () => {
        const res = await request(app).get('/api/resenas?calificacion=9');
        expect(res.status).toBe(400);
    });

    test('error 400: id_videojuego inválido', async () => {
        const res = await request(app).get('/api/resenas?id_videojuego=abc');
        expect(res.status).toBe(400);
    });
});

describe('GET /api/videojuegos/:id/resenas', () => {
    test('éxito', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(videojuego);
        resenasRepo.listar.mockResolvedValue({ total: 1, resenas: [resena] });

        const res = await request(app).get('/api/videojuegos/1/resenas');

        expect(res.status).toBe(200);
        expect(resenasRepo.listar.mock.calls[0][0].idVideojuego).toBe(1);
    });

    test('error 404: el videojuego no existe', async () => {
        videojuegosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app).get('/api/videojuegos/99/resenas');

        expect(res.status).toBe(404);
    });
});

describe('GET /api/resenas/:id', () => {
    test('éxito', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);

        const res = await request(app).get('/api/resenas/5');

        expect(res.status).toBe(200);
        expect(res.body.etiquetas).toHaveLength(1);
    });

    test('error 404', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(null);
        const res = await request(app).get('/api/resenas/99');
        expect(res.status).toBe(404);
    });

    test('error 400: ID inválido', async () => {
        const res = await request(app).get('/api/resenas/cinco');
        expect(res.status).toBe(400);
    });
});

describe('PUT /api/resenas/:id', () => {
    test('éxito: el autor edita su reseña y reemplaza etiquetas', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);
        etiquetasRepo.idsExistentes.mockResolvedValue([2]);
        resenasRepo.actualizar.mockResolvedValue({ ...resena, calificacion: 5 });

        const res = await request(app)
            .put('/api/resenas/5')
            .set('Authorization', tokens.ana)
            .send({ calificacion: 5, comentario: 'Obra maestra', etiquetas: [2] });

        expect(res.status).toBe(200);
        expect(resenasRepo.actualizar).toHaveBeenCalledWith(
            5,
            { calificacion: 5, comentario: 'Obra maestra', horas_jugadas: null },
            [2]
        );
    });

    test('éxito: sin `etiquetas` en el cuerpo se conservan las actuales', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);
        resenasRepo.actualizar.mockResolvedValue(resena);

        await request(app)
            .put('/api/resenas/5')
            .set('Authorization', tokens.ana)
            .send({ calificacion: 3 });

        expect(resenasRepo.actualizar.mock.calls[0][2]).toBeUndefined();
    });

    test('error 403: otro usuario no puede editarla', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);

        const res = await request(app)
            .put('/api/resenas/5')
            .set('Authorization', tokens.beto)
            .send({ calificacion: 1 });

        expect(res.status).toBe(403);
    });

    test('error 403: ni siquiera un administrador reescribe opiniones ajenas', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);

        const res = await request(app)
            .put('/api/resenas/5')
            .set('Authorization', tokens.admin)
            .send({ calificacion: 1 });

        expect(res.status).toBe(403);
    });

    test('error 400: calificación inválida', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);

        const res = await request(app)
            .put('/api/resenas/5')
            .set('Authorization', tokens.ana)
            .send({ calificacion: 10 });

        expect(res.status).toBe(400);
    });

    test('error 404: la reseña no existe', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/resenas/99')
            .set('Authorization', tokens.ana)
            .send({ calificacion: 3 });

        expect(res.status).toBe(404);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).put('/api/resenas/5').send({ calificacion: 3 });
        expect(res.status).toBe(401);
    });
});

describe('DELETE /api/resenas/:id', () => {
    test('éxito: el autor elimina su reseña', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);
        resenasRepo.eliminar.mockResolvedValue(true);

        const res = await request(app).delete('/api/resenas/5').set('Authorization', tokens.ana);

        expect(res.status).toBe(200);
        expect(resenasRepo.eliminar).toHaveBeenCalledWith(5);
    });

    test('éxito: un administrador modera (elimina) reseñas ajenas', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);
        resenasRepo.eliminar.mockResolvedValue(true);

        const res = await request(app).delete('/api/resenas/5').set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 403: otro usuario', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(resena);

        const res = await request(app).delete('/api/resenas/5').set('Authorization', tokens.beto);

        expect(res.status).toBe(403);
        expect(resenasRepo.eliminar).not.toHaveBeenCalled();
    });

    test('error 404: no existe', async () => {
        resenasRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app).delete('/api/resenas/99').set('Authorization', tokens.ana);

        expect(res.status).toBe(404);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).delete('/api/resenas/5');
        expect(res.status).toBe(401);
    });
});
