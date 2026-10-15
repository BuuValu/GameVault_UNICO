const progresoRepository = require('../repositories/progreso.repository');
const logrosRepository = require('../repositories/logros.repository');
const comprasRepository = require('../repositories/compras.repository');
const usuariosRepository = require('../repositories/usuarios.repository');
const { errorHttp } = require('../utils/errores');
const { cuerpo, idDeRuta, entero } = require('../utils/validaciones');

async function exigirUsuario(id) {
    const idValido = idDeRuta(id, 'El ID del usuario');

    if (!(await usuariosRepository.buscarPorId(idValido))) {
        throw errorHttp('Usuario no encontrado.', 404);
    }

    return idValido;
}

async function listar(idUsuario, consulta) {
    const id = await exigirUsuario(idUsuario);
    const idVideojuego = consulta.id_videojuego === undefined
        ? undefined
        : idDeRuta(consulta.id_videojuego, 'id_videojuego');

    return progresoRepository.listarPorUsuario(id, idVideojuego);
}

async function obtener(idUsuario, idLogro) {
    const id = await exigirUsuario(idUsuario);
    const idLogroValido = idDeRuta(idLogro, 'El ID del logro');

    if (!(await logrosRepository.buscarPorId(idLogroValido))) {
        throw errorHttp('Logro no encontrado.', 404);
    }

    const progreso = await progresoRepository.buscar(id, idLogroValido);

    if (!progreso) {
        throw errorHttp('El usuario aún no tiene progreso en este logro.', 404);
    }

    return progreso;
}

/**
 * PUT idempotente: fija el progreso del usuario en un logro.
 * Reglas: el usuario debe tener la compra confirmada del videojuego, el
 * progreso no puede superar la meta ni retroceder, y al alcanzar la meta
 * el logro se desbloquea (la fecha original se conserva).
 */
async function registrar(idUsuario, idLogro, body) {
    const id = await exigirUsuario(idUsuario);
    const idLogroValido = idDeRuta(idLogro, 'El ID del logro');
    const progreso = entero(cuerpo(body).progreso, 'progreso', {
        min: 0,
        max: 1000000
    });

    const logro = await logrosRepository.buscarPorId(idLogroValido);

    if (!logro) {
        throw errorHttp('Logro no encontrado.', 404);
    }

    const compra = await comprasRepository.buscarPorUsuarioYVideojuego(
        id,
        logro.id_videojuego
    );

    if (!compra || compra.estado !== 'confirmada') {
        throw errorHttp(
            'El usuario necesita una compra confirmada del videojuego para avanzar en sus logros.',
            403
        );
    }

    // Los logros simple/fecha se completan con progreso = 1.
    const metaEfectiva = logro.tipo === 'progreso' ? logro.meta : 1;

    if (progreso > metaEfectiva) {
        throw errorHttp(`El progreso no puede superar la meta (${metaEfectiva}).`);
    }

    const actual = await progresoRepository.buscar(id, idLogroValido);

    if (actual && progreso < actual.progreso) {
        throw errorHttp(
            `El progreso no puede disminuir (actual: ${actual.progreso}).`,
            409
        );
    }

    const desbloqueado = progreso >= metaEfectiva;
    const fechaDesbloqueo = desbloqueado
        ? (actual && actual.desbloqueado ? actual.fecha_desbloqueo : new Date())
        : null;

    const guardado = await progresoRepository.guardar({
        idUsuario: id,
        idLogro: idLogroValido,
        progreso,
        desbloqueado,
        fechaDesbloqueo
    });

    return { creado: !actual, progreso: guardado };
}

async function reiniciar(idUsuario, idLogro) {
    const id = await exigirUsuario(idUsuario);
    const idLogroValido = idDeRuta(idLogro, 'El ID del logro');

    if (!(await progresoRepository.eliminar(id, idLogroValido))) {
        throw errorHttp('El usuario no tiene progreso registrado en ese logro.', 404);
    }

    return { mensaje: 'Progreso reiniciado correctamente.' };
}

module.exports = { listar, obtener, registrar, reiniciar };
