// Géneros y etiquetas comparten la misma lógica de catálogo; se prueban los dos.
jest.mock('../config/db', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn()
}));
jest.mock('../repositories/generos.repository');
jest.mock('../repositories/etiquetas.repository');

const request = require('supertest');
const app = require('../app');
const generosRepo = require('../repositories/generos.repository');
const etiquetasRepo = require('../repositories/etiquetas.repository');
const { tokens, errorMysql } = require('./helpers');

beforeEach(() => {
    jest.resetAllMocks();
});

describe.each([
    {
        recurso: 'generos',
        repo: generosRepo,
        pk: 'id_genero',
        uso: 'total_videojuegos',
        ejemplo: 'Acción'
    },
    {
        recurso: 'etiquetas',
        repo: etiquetasRepo,
        pk: 'id_etiqueta',
        uso: 'total_resenas',
        ejemplo: 'Divertido'
    }
])('/api/$recurso', ({ recurso, repo, pk, uso, ejemplo }) => {
    const url = `/api/${recurso}`;
    const registro = { [pk]: 1, nombre: ejemplo, [uso]: 0 };

    describe(`GET ${url}`, () => {
        test('éxito: lista pública', async () => {
            repo.listar.mockResolvedValue([registro]);

            const res = await request(app).get(url);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([registro]);
        });

        test('error 503: la base de datos no responde', async () => {
            repo.listar.mockRejectedValue(errorMysql('PROTOCOL_CONNECTION_LOST'));
            jest.spyOn(console, 'error').mockImplementation(() => {});

            const res = await request(app).get(url);

            expect(res.status).toBe(503);
        });
    });

    describe(`GET ${url}/:id`, () => {
        test('éxito', async () => {
            repo.buscarPorId.mockResolvedValue(registro);

            const res = await request(app).get(`${url}/1`);

            expect(res.status).toBe(200);
            expect(res.body.nombre).toBe(ejemplo);
        });

        test('error 404: no existe', async () => {
            repo.buscarPorId.mockResolvedValue(null);
            const res = await request(app).get(`${url}/99`);
            expect(res.status).toBe(404);
        });

        test('error 400: ID inválido', async () => {
            const res = await request(app).get(`${url}/uno`);
            expect(res.status).toBe(400);
        });
    });

    describe(`POST ${url}`, () => {
        test('éxito 201: crea y recorta espacios del nombre', async () => {
            repo.buscarPorNombre.mockResolvedValue(null);
            repo.crear.mockResolvedValue(registro);

            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send({ nombre: `  ${ejemplo}  ` });

            expect(res.status).toBe(201);
            expect(repo.crear).toHaveBeenCalledWith(ejemplo);
        });

        test('error 401: sin token', async () => {
            const res = await request(app).post(url).send({ nombre: ejemplo });
            expect(res.status).toBe(401);
        });

        test('error 403: usuario normal', async () => {
            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.ana)
                .send({ nombre: ejemplo });
            expect(res.status).toBe(403);
        });

        test.each([
            ['nombre vacío', { nombre: '   ' }],
            ['sin nombre', {}],
            ['nombre no es texto', { nombre: 123 }],
            ['nombre demasiado largo', { nombre: 'x'.repeat(61) }]
        ])('error 400: %s', async (_caso, cuerpo) => {
            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send(cuerpo);

            expect(res.status).toBe(400);
            expect(repo.crear).not.toHaveBeenCalled();
        });

        test('error 409: nombre duplicado', async () => {
            repo.buscarPorNombre.mockResolvedValue(registro);

            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send({ nombre: ejemplo });

            expect(res.status).toBe(409);
        });

        test('error MySQL ER_DUP_ENTRY (carrera) → 409', async () => {
            repo.buscarPorNombre.mockResolvedValue(null);
            repo.crear.mockRejectedValue(errorMysql('ER_DUP_ENTRY'));

            const res = await request(app)
                .post(url)
                .set('Authorization', tokens.admin)
                .send({ nombre: ejemplo });

            expect(res.status).toBe(409);
        });
    });

    describe(`PUT ${url}/:id`, () => {
        test('éxito: renombra', async () => {
            repo.buscarPorId.mockResolvedValue(registro);
            repo.buscarPorNombre.mockResolvedValue(null);
            repo.actualizar.mockResolvedValue({ ...registro, nombre: 'Nuevo' });

            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ nombre: 'Nuevo' });

            expect(res.status).toBe(200);
            expect(res.body.nombre).toBe('Nuevo');
        });

        test('éxito: reenviar el mismo nombre no es conflicto', async () => {
            repo.buscarPorId.mockResolvedValue(registro);
            repo.buscarPorNombre.mockResolvedValue(registro);
            repo.actualizar.mockResolvedValue(registro);

            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ nombre: ejemplo });

            expect(res.status).toBe(200);
        });

        test('error 404: no existe', async () => {
            repo.buscarPorId.mockResolvedValue(null);

            const res = await request(app)
                .put(`${url}/99`)
                .set('Authorization', tokens.admin)
                .send({ nombre: 'Nuevo' });

            expect(res.status).toBe(404);
        });

        test('error 409: el nombre es de otro registro', async () => {
            repo.buscarPorId.mockResolvedValue(registro);
            repo.buscarPorNombre.mockResolvedValue({ [pk]: 2, nombre: 'Otro' });

            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ nombre: 'Otro' });

            expect(res.status).toBe(409);
        });

        test('error 400: nombre vacío', async () => {
            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.admin)
                .send({ nombre: '' });

            expect(res.status).toBe(400);
        });

        test('error 403: usuario normal', async () => {
            const res = await request(app)
                .put(`${url}/1`)
                .set('Authorization', tokens.ana)
                .send({ nombre: 'Nuevo' });

            expect(res.status).toBe(403);
        });
    });

    describe(`DELETE ${url}/:id`, () => {
        test('éxito: elimina un registro sin uso', async () => {
            repo.buscarPorId.mockResolvedValue(registro);
            repo.eliminar.mockResolvedValue(true);

            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(200);
            expect(repo.eliminar).toHaveBeenCalledWith(1);
        });

        test('error 409: está en uso', async () => {
            repo.buscarPorId.mockResolvedValue({ ...registro, [uso]: 3 });

            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(409);
            expect(repo.eliminar).not.toHaveBeenCalled();
        });

        test('error MySQL ER_ROW_IS_REFERENCED_2 → 409', async () => {
            repo.buscarPorId.mockResolvedValue(registro);
            repo.eliminar.mockRejectedValue(errorMysql('ER_ROW_IS_REFERENCED_2'));

            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(409);
        });

        test('error 404: no existe', async () => {
            repo.buscarPorId.mockResolvedValue(null);

            const res = await request(app)
                .delete(`${url}/99`)
                .set('Authorization', tokens.admin);

            expect(res.status).toBe(404);
        });

        test('error 403: usuario normal', async () => {
            const res = await request(app)
                .delete(`${url}/1`)
                .set('Authorization', tokens.ana);

            expect(res.status).toBe(403);
        });
    });
});
