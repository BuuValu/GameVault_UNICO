jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/videojuegos.repository');
jest.mock('../repositories/generos.repository');

const request = require('supertest');
const app = require('../app');
const repo = require('../repositories/videojuegos.repository');
const generosRepo = require('../repositories/generos.repository');
const { tokens, videojuego, errorMysql } = require('./helpers');

const datosValidos = {
    nombre: 'Zelda',
    descripcion: 'Aventura épica',
    precio: 59.99,
    clasificacion_edad: '12+',
    generos: [1]
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('GET /api/videojuegos', () => {
    test('éxito: el público recibe solo videojuegos activos, paginados', async () => {
        repo.listar.mockResolvedValue({ total: 1, videojuegos: [videojuego] });

        const res = await request(app).get('/api/videojuegos');

        expect(res.status).toBe(200);
        expect(res.body.datos).toHaveLength(1);
        expect(res.body.paginacion).toEqual({ pagina: 1, limite: 20, total: 1, paginas: 1 });
        expect(repo.listar.mock.calls[0][0].activo).toBe(true);
    });

    test('éxito: un administrador puede ver todos con ?activo=todos', async () => {
        repo.listar.mockResolvedValue({ total: 0, videojuegos: [] });

        const res = await request(app)
            .get('/api/videojuegos?activo=todos')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(repo.listar.mock.calls[0][0].activo).toBeUndefined();
    });

    test('éxito: los filtros llegan al repositorio', async () => {
        repo.listar.mockResolvedValue({ total: 0, videojuegos: [] });

        await request(app).get(
            '/api/videojuegos?q=zel&genero=2&precio_min=10&precio_max=80&orden=precio_asc&pagina=2&limite=5'
        );

        expect(repo.listar.mock.calls[0][0]).toMatchObject({
            q: 'zel',
            genero: 2,
            precioMin: 10,
            precioMax: 80,
            orden: 'precio_asc',
            limite: 5,
            offset: 5
        });
    });

    test('error 400: orden no permitido', async () => {
        const res = await request(app).get('/api/videojuegos?orden=hackeo');
        expect(res.status).toBe(400);
    });

    test('error 400: limite fuera de rango', async () => {
        const res = await request(app).get('/api/videojuegos?limite=0');
        expect(res.status).toBe(400);
    });

    test('error 400: precio_min mayor que precio_max', async () => {
        const res = await request(app).get('/api/videojuegos?precio_min=50&precio_max=10');
        expect(res.status).toBe(400);
    });

    test('error 401: token enviado pero inválido', async () => {
        const res = await request(app)
            .get('/api/videojuegos')
            .set('Authorization', tokens.invalido);
        expect(res.status).toBe(401);
    });
});

describe('GET /api/videojuegos/:id', () => {
    test('éxito: devuelve el videojuego con sus géneros', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);

        const res = await request(app).get('/api/videojuegos/1');

        expect(res.status).toBe(200);
        expect(res.body.nombre).toBe('Zelda');
        expect(res.body.generos).toHaveLength(1);
    });

    test('éxito: un administrador ve un videojuego inactivo', async () => {
        repo.buscarPorId.mockResolvedValue({ ...videojuego, activo: false });

        const res = await request(app)
            .get('/api/videojuegos/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('error 404: no existe', async () => {
        repo.buscarPorId.mockResolvedValue(null);
        const res = await request(app).get('/api/videojuegos/999');
        expect(res.status).toBe(404);
    });

    test('error 404: inactivo para el público', async () => {
        repo.buscarPorId.mockResolvedValue({ ...videojuego, activo: false });
        const res = await request(app).get('/api/videojuegos/1');
        expect(res.status).toBe(404);
    });

    test('error 400: ID no numérico', async () => {
        const res = await request(app).get('/api/videojuegos/abc');
        expect(res.status).toBe(400);
    });
});

describe('POST /api/videojuegos', () => {
    function prepararCreacion() {
        repo.buscarPorNombre.mockResolvedValue(null);
        generosRepo.idsExistentes.mockResolvedValue([1]);
        repo.crear.mockResolvedValue(videojuego);
    }

    test('éxito 201: crea el videojuego con sus géneros y devuelve Location', async () => {
        prepararCreacion();

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(201);
        expect(res.headers.location).toBe('/api/videojuegos/1');
        expect(repo.crear).toHaveBeenCalledWith(
            expect.objectContaining({ nombre: 'Zelda', activo: true }),
            [1]
        );
    });

    test('éxito: normaliza la clasificación a mayúsculas', async () => {
        prepararCreacion();

        await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send({ ...datosValidos, clasificacion_edad: 'todos' });

        expect(repo.crear.mock.calls[0][0].clasificacion_edad).toBe('TODOS');
    });

    test('error 401: sin token', async () => {
        const res = await request(app).post('/api/videojuegos').send(datosValidos);
        expect(res.status).toBe(401);
    });

    test('error 403: un usuario normal no puede crear', async () => {
        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.ana)
            .send(datosValidos);
        expect(res.status).toBe(403);
    });

    test.each([
        ['precio negativo', { precio: -5 }],
        ['precio con 3 decimales', { precio: 1.234 }],
        ['precio como texto', { precio: '10' }],
        ['nombre vacío', { nombre: '   ' }],
        ['descripción ausente', { descripcion: undefined }],
        ['clasificación inválida', { clasificacion_edad: 'XX' }],
        ['URL de imagen inválida', { imagen_url: 'ftp://servidor/img.png' }],
        ['activo no booleano', { activo: 'si' }],
        ['generos no es arreglo', { generos: 'accion' }]
    ])('error 400: %s', async (_nombre, cambio) => {
        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send({ ...datosValidos, ...cambio });

        expect(res.status).toBe(400);
        expect(repo.crear).not.toHaveBeenCalled();
    });

    test('error 400: algún género no existe', async () => {
        repo.buscarPorNombre.mockResolvedValue(null);
        generosRepo.idsExistentes.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send({ ...datosValidos, generos: [99] });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('99');
    });

    test('error 400: JSON mal formado', async () => {
        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .set('Content-Type', 'application/json')
            .send('{"nombre":');

        expect(res.status).toBe(400);
    });

    test('error 409: ya existe un videojuego con ese nombre', async () => {
        generosRepo.idsExistentes.mockResolvedValue([1]);
        repo.buscarPorNombre.mockResolvedValue({ id_videojuego: 9, nombre: 'Zelda' });

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_DUP_ENTRY (carrera entre solicitudes) → 409', async () => {
        prepararCreacion();
        repo.crear.mockRejectedValue(errorMysql('ER_DUP_ENTRY'));

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(409);
    });

    test('error MySQL ER_NO_REFERENCED_ROW_2 → 400', async () => {
        prepararCreacion();
        repo.crear.mockRejectedValue(errorMysql('ER_NO_REFERENCED_ROW_2'));

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(400);
    });

    test('error MySQL caída de la base de datos → 503', async () => {
        prepararCreacion();
        repo.crear.mockRejectedValue(errorMysql('ECONNREFUSED'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(503);
    });

    test('error inesperado → 500 sin filtrar detalles internos', async () => {
        prepararCreacion();
        repo.crear.mockRejectedValue(new Error('detalle interno secreto'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/api/videojuegos')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toContain('secreto');
    });
});

describe('PUT /api/videojuegos/:id', () => {
    test('éxito: reemplaza los datos y conserva `activo` si se omite', async () => {
        repo.buscarPorId.mockResolvedValue({ ...videojuego, activo: false });
        repo.buscarPorNombre.mockResolvedValue({ id_videojuego: 1, nombre: 'Zelda' });
        generosRepo.idsExistentes.mockResolvedValue([1]);
        repo.actualizar.mockResolvedValue({ ...videojuego, precio: 49.5 });

        const res = await request(app)
            .put('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send({ ...datosValidos, precio: 49.5 });

        expect(res.status).toBe(200);
        expect(repo.actualizar.mock.calls[0][1].activo).toBe(false);
    });

    test('error 404: el videojuego no existe', async () => {
        repo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/videojuegos/999')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(404);
    });

    test('error 400: PUT con datos incompletos', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);

        const res = await request(app)
            .put('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send({ nombre: 'Zelda' });

        expect(res.status).toBe(400);
    });

    test('error 409: el nuevo nombre pertenece a otro videojuego', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        generosRepo.idsExistentes.mockResolvedValue([1]);
        repo.buscarPorNombre.mockResolvedValue({ id_videojuego: 2, nombre: 'Zelda' });

        const res = await request(app)
            .put('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send(datosValidos);

        expect(res.status).toBe(409);
    });

    test('error 403: un usuario normal', async () => {
        const res = await request(app)
            .put('/api/videojuegos/1')
            .set('Authorization', tokens.ana)
            .send(datosValidos);
        expect(res.status).toBe(403);
    });
});

describe('PATCH /api/videojuegos/:id', () => {
    test('éxito: cambia solo el precio y mantiene el resto', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.buscarPorNombre.mockResolvedValue({ id_videojuego: 1, nombre: 'Zelda' });
        repo.actualizar.mockResolvedValue({ ...videojuego, precio: 39.99 });

        const res = await request(app)
            .patch('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send({ precio: 39.99 });

        expect(res.status).toBe(200);
        expect(repo.actualizar.mock.calls[0][1]).toMatchObject({
            nombre: 'Zelda',
            precio: 39.99
        });
        // No se enviaron géneros: no se tocan.
        expect(repo.actualizar.mock.calls[0][2]).toBeUndefined();
    });

    test('éxito: desactivar un videojuego (alternativa a eliminarlo)', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.buscarPorNombre.mockResolvedValue({ id_videojuego: 1, nombre: 'Zelda' });
        repo.actualizar.mockResolvedValue({ ...videojuego, activo: false });

        const res = await request(app)
            .patch('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send({ activo: false });

        expect(res.status).toBe(200);
        expect(repo.actualizar.mock.calls[0][1].activo).toBe(false);
    });

    test('error 400: cuerpo sin campos reconocidos', async () => {
        const res = await request(app)
            .patch('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send({ otroCampo: 1 });

        expect(res.status).toBe(400);
    });

    test('error 400: valor inválido', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);

        const res = await request(app)
            .patch('/api/videojuegos/1')
            .set('Authorization', tokens.admin)
            .send({ precio: -1 });

        expect(res.status).toBe(400);
    });

    test('error 404: no existe', async () => {
        repo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .patch('/api/videojuegos/999')
            .set('Authorization', tokens.admin)
            .send({ precio: 10 });

        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/videojuegos/:id', () => {
    test('éxito: elimina un videojuego sin compras', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.tieneCompras.mockResolvedValue(false);
        repo.eliminar.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/videojuegos/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
        expect(repo.eliminar).toHaveBeenCalledWith(1);
    });

    test('error 409: tiene compras registradas (se sugiere desactivar)', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.tieneCompras.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/videojuegos/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('Desactívalo');
        expect(repo.eliminar).not.toHaveBeenCalled();
    });

    test('error MySQL ER_ROW_IS_REFERENCED_2 (compra creada justo antes) → 409', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.tieneCompras.mockResolvedValue(false);
        repo.eliminar.mockRejectedValue(errorMysql('ER_ROW_IS_REFERENCED_2'));

        const res = await request(app)
            .delete('/api/videojuegos/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(409);
    });

    test('error 404: no existe', async () => {
        repo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/videojuegos/999')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('error 403: un usuario normal', async () => {
        const res = await request(app)
            .delete('/api/videojuegos/1')
            .set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('error 401: sin token', async () => {
        const res = await request(app).delete('/api/videojuegos/1');
        expect(res.status).toBe(401);
    });
});

describe('Géneros de un videojuego (N:M)', () => {
    test('GET /:id/generos éxito', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);

        const res = await request(app).get('/api/videojuegos/1/generos');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(videojuego.generos);
    });

    test('GET /:id/generos error 404', async () => {
        repo.buscarPorId.mockResolvedValue(null);
        const res = await request(app).get('/api/videojuegos/9/generos');
        expect(res.status).toBe(404);
    });

    test('PUT /:id/generos/:idGenero éxito 201 cuando es nuevo', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        generosRepo.buscarPorId.mockResolvedValue({ id_genero: 2, nombre: 'RPG' });
        repo.agregarGenero.mockResolvedValue(true);

        const res = await request(app)
            .put('/api/videojuegos/1/generos/2')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(201);
    });

    test('PUT /:id/generos/:idGenero es idempotente: 200 si ya existía', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        generosRepo.buscarPorId.mockResolvedValue({ id_genero: 1, nombre: 'Acción' });
        repo.agregarGenero.mockResolvedValue(false);

        const res = await request(app)
            .put('/api/videojuegos/1/generos/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('PUT /:id/generos/:idGenero error 404: el género no existe', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        generosRepo.buscarPorId.mockResolvedValue(null);

        const res = await request(app)
            .put('/api/videojuegos/1/generos/99')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });

    test('PUT /:id/generos/:idGenero error 403: usuario normal', async () => {
        const res = await request(app)
            .put('/api/videojuegos/1/generos/2')
            .set('Authorization', tokens.ana);
        expect(res.status).toBe(403);
    });

    test('DELETE /:id/generos/:idGenero éxito', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.quitarGenero.mockResolvedValue(true);

        const res = await request(app)
            .delete('/api/videojuegos/1/generos/1')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(200);
    });

    test('DELETE /:id/generos/:idGenero error 404: no estaba asociado', async () => {
        repo.buscarPorId.mockResolvedValue(videojuego);
        repo.quitarGenero.mockResolvedValue(false);

        const res = await request(app)
            .delete('/api/videojuegos/1/generos/5')
            .set('Authorization', tokens.admin);

        expect(res.status).toBe(404);
    });
});
