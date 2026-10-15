const comprasRepository = require('../repositories/compras.repository');
const videojuegosRepository = require('../repositories/videojuegos.repository');
const usuariosRepository = require('../repositories/usuarios.repository');
const { errorHttp } = require('../utils/errores');
const {
    cuerpo,
    idDeRuta,
    entero,
    paginacion,
    respuestaPaginada
} = require('../utils/validaciones');

const ESTADOS = ['pendiente', 'confirmada', 'fallida'];
const ESTADOS_DESTINO = ['confirmada', 'fallida'];

const esAdmin = (usuario) => usuario.rol === 'administrador';

function puedeVer(compra, usuario) {
    return esAdmin(usuario) || compra.id_usuario === Number(usuario.id_usuario);
}

function leerFiltros(consulta) {
    const filtros = paginacion(consulta);

    if (consulta.estado !== undefined) {
        if (!ESTADOS.includes(consulta.estado)) {
            throw errorHttp(`estado debe ser uno de: ${ESTADOS.join(', ')}.`);
        }
        filtros.estado = consulta.estado;
    }

    if (consulta.id_videojuego !== undefined) {
        filtros.idVideojuego = idDeRuta(consulta.id_videojuego, 'id_videojuego');
    }

    return filtros;
}

/** Admin: todas las compras. Admite ?id_usuario, ?id_videojuego y ?estado. */
async function listar(consulta) {
    const filtros = leerFiltros(consulta);

    if (consulta.id_usuario !== undefined) {
        filtros.idUsuario = idDeRuta(consulta.id_usuario, 'id_usuario');
    }

    const { total, compras } = await comprasRepository.listar(filtros);

    return respuestaPaginada(compras, total, filtros);
}

/** Compras de un usuario concreto (la ruta ya validó dueño o admin). */
async function listarPorUsuario(idUsuario, consulta) {
    const idValido = idDeRuta(idUsuario, 'El ID del usuario');
    const filtros = { ...leerFiltros(consulta), idUsuario: idValido };

    if (!(await usuariosRepository.buscarPorId(idValido))) {
        throw errorHttp('Usuario no encontrado.', 404);
    }

    const { total, compras } = await comprasRepository.listar(filtros);

    return respuestaPaginada(compras, total, filtros);
}

async function obtener(id, usuario) {
    const compra = await comprasRepository.buscarPorId(idDeRuta(id));

    if (!compra) {
        throw errorHttp('Compra no encontrada.', 404);
    }

    if (!puedeVer(compra, usuario)) {
        throw errorHttp('No tienes permiso para ver esta compra.', 403);
    }

    return compra;
}

/**
 * El usuario sale del token y el precio del catálogo: el cliente
 * nunca decide quién compra ni cuánto paga.
 */
async function crear(usuario, body) {
    const idVideojuego = entero(cuerpo(body).id_videojuego, 'id_videojuego');
    const idUsuario = Number(usuario.id_usuario);

    const videojuego = await videojuegosRepository.buscarPorId(idVideojuego);

    if (!videojuego) {
        throw errorHttp('El videojuego indicado no existe.', 400);
    }

    if (!videojuego.activo) {
        throw errorHttp('El videojuego no está disponible para la compra.', 409);
    }

    const existente = await comprasRepository.buscarPorUsuarioYVideojuego(
        idUsuario,
        idVideojuego
    );

    if (!existente) {
        return comprasRepository.crear({
            idUsuario,
            idVideojuego,
            precio: videojuego.precio
        });
    }

    if (existente.estado === 'fallida') {
        const reintento = await comprasRepository.reintentar(
            existente.id_compra,
            videojuego.precio
        );

        if (reintento) {
            return reintento;
        }
    }

    throw errorHttp(
        `Ya tienes una compra de este videojuego (estado: ${existente.estado}).`,
        409
    );
}

async function cambiarEstado(id, body) {
    const idValido = idDeRuta(id);
    const { estado } = cuerpo(body);

    if (!ESTADOS_DESTINO.includes(estado)) {
        throw errorHttp(`estado debe ser uno de: ${ESTADOS_DESTINO.join(', ')}.`);
    }

    const compra = await comprasRepository.buscarPorId(idValido);

    if (!compra) {
        throw errorHttp('Compra no encontrada.', 404);
    }

    if (compra.estado !== 'pendiente') {
        throw errorHttp(
            `Solo se puede cambiar el estado de una compra pendiente (actual: ${compra.estado}).`,
            409
        );
    }

    const actualizada = await comprasRepository.cambiarEstado(
        idValido,
        'pendiente',
        estado
    );

    if (!actualizada) {
        throw errorHttp('La compra cambió de estado mientras se procesaba.', 409);
    }

    return actualizada;
}

async function cancelar(id, usuario) {
    const compra = await obtener(id, usuario);

    if (compra.estado !== 'pendiente') {
        throw errorHttp(
            `Solo se puede cancelar una compra pendiente (actual: ${compra.estado}).`,
            409
        );
    }

    const eliminada = await comprasRepository.eliminarPendiente(compra.id_compra);

    if (!eliminada) {
        throw errorHttp('La compra cambió de estado mientras se procesaba.', 409);
    }

    return { mensaje: 'Compra cancelada correctamente.' };
}

module.exports = {
    listar,
    listarPorUsuario,
    obtener,
    crear,
    cambiarEstado,
    cancelar
};
