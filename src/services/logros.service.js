const logrosRepository = require('../repositories/logros.repository');
const progresoRepository = require('../repositories/progreso.repository');
const videojuegosRepository = require('../repositories/videojuegos.repository');
const { errorHttp } = require('../utils/errores');
const {
    cuerpo,
    idDeRuta,
    entero,
    textoRequerido
} = require('../utils/validaciones');

const TIPOS = ['simple', 'progreso', 'fecha'];

/**
 * Regla de negocio: un logro de tipo "progreso" necesita una meta (> 0);
 * los de tipo "simple" y "fecha" se desbloquean de una vez y no llevan meta.
 */
function validarLogro(datos) {
    const nombre = textoRequerido(datos.nombre, 'El nombre', 120);
    const descripcion = textoRequerido(datos.descripcion, 'La descripción', 1000);
    const tipo = datos.tipo === undefined ? 'simple' : datos.tipo;

    if (!TIPOS.includes(tipo)) {
        throw errorHttp(`tipo debe ser uno de: ${TIPOS.join(', ')}.`);
    }

    let meta = null;

    if (tipo === 'progreso') {
        if (datos.meta === undefined || datos.meta === null) {
            throw errorHttp('Los logros de tipo progreso requieren una meta.');
        }
        meta = entero(datos.meta, 'meta', { min: 1, max: 1000000 });
    } else if (datos.meta !== undefined && datos.meta !== null) {
        throw errorHttp(`Los logros de tipo ${tipo} no admiten meta.`);
    }

    return { nombre, descripcion, tipo, meta };
}

async function listarPorVideojuego(idVideojuego) {
    const id = idDeRuta(idVideojuego);

    if (!(await videojuegosRepository.buscarPorId(id))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    return logrosRepository.listarPorVideojuego(id);
}

async function obtener(id) {
    const logro = await logrosRepository.buscarPorId(idDeRuta(id));

    if (!logro) {
        throw errorHttp('Logro no encontrado.', 404);
    }

    return logro;
}

async function crear(idVideojuego, body) {
    const id = idDeRuta(idVideojuego);
    const datos = validarLogro(cuerpo(body));

    if (!(await videojuegosRepository.buscarPorId(id))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    if (await logrosRepository.buscarPorNombre(id, datos.nombre)) {
        throw errorHttp('Ese videojuego ya tiene un logro con ese nombre.', 409);
    }

    return logrosRepository.crear(id, datos);
}

async function actualizar(id, body) {
    const actual = await obtener(id);
    const datos = validarLogro(cuerpo(body));

    const repetido = await logrosRepository.buscarPorNombre(
        actual.id_videojuego,
        datos.nombre
    );

    if (repetido && repetido.id_logro !== actual.id_logro) {
        throw errorHttp('Ese videojuego ya tiene un logro con ese nombre.', 409);
    }

    // Cambiar tipo o meta dejaría incoherentes los progresos ya guardados.
    const cambiaCondicion = datos.tipo !== actual.tipo || datos.meta !== actual.meta;

    if (
        cambiaCondicion &&
        (await progresoRepository.contarPorLogro(actual.id_logro)) > 0
    ) {
        throw errorHttp(
            'No se puede cambiar el tipo ni la meta de un logro que ya tiene progreso registrado.',
            409
        );
    }

    return logrosRepository.actualizar(actual.id_logro, datos);
}

async function eliminar(id) {
    const logro = await obtener(id);

    await logrosRepository.eliminar(logro.id_logro);

    return { mensaje: 'Logro eliminado correctamente.' };
}

module.exports = {
    listarPorVideojuego,
    obtener,
    crear,
    actualizar,
    eliminar
};
