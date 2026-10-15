const resenasRepository = require('../repositories/resenas.repository');
const comprasRepository = require('../repositories/compras.repository');
const videojuegosRepository = require('../repositories/videojuegos.repository');
const etiquetasService = require('./etiquetas.service');
const { errorHttp } = require('../utils/errores');
const {
    cuerpo,
    idDeRuta,
    entero,
    textoOpcional,
    decimalNoNegativo,
    listaDeIds,
    paginacion,
    respuestaPaginada
} = require('../utils/validaciones');

const MAX_HORAS = 99999.99; // DECIMAL(7,2)

const esAdmin = (usuario) => usuario.rol === 'administrador';

/** Valida los campos editables de una reseña (comunes a POST y PUT). */
async function validarContenido(datos) {
    const contenido = {
        calificacion: entero(datos.calificacion, 'calificacion', { min: 1, max: 5 }),
        comentario: textoOpcional(datos.comentario, 'comentario', 2000),
        horas_jugadas: datos.horas_jugadas === undefined || datos.horas_jugadas === null
            ? null
            : decimalNoNegativo(datos.horas_jugadas, 'horas_jugadas', MAX_HORAS)
    };

    let etiquetas;

    if (datos.etiquetas !== undefined) {
        etiquetas = listaDeIds(datos.etiquetas, 'etiquetas', 10);
        await etiquetasService.exigirExistentes(etiquetas, 'etiquetas');
    }

    return { contenido, etiquetas };
}

async function listar(consulta) {
    const filtros = paginacion(consulta);

    if (consulta.id_videojuego !== undefined) {
        filtros.idVideojuego = idDeRuta(consulta.id_videojuego, 'id_videojuego');
    }

    if (consulta.id_usuario !== undefined) {
        filtros.idUsuario = idDeRuta(consulta.id_usuario, 'id_usuario');
    }

    if (consulta.calificacion !== undefined) {
        filtros.calificacion = entero(
            Number(consulta.calificacion),
            'calificacion',
            { min: 1, max: 5 }
        );
    }

    const { total, resenas } = await resenasRepository.listar(filtros);

    return respuestaPaginada(resenas, total, filtros);
}

/** GET /api/videojuegos/:id/resenas */
async function listarPorVideojuego(idVideojuego, consulta) {
    const id = idDeRuta(idVideojuego);

    if (!(await videojuegosRepository.buscarPorId(id))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    return listar({ ...consulta, id_videojuego: id });
}

async function obtener(id) {
    const resena = await resenasRepository.buscarPorId(idDeRuta(id));

    if (!resena) {
        throw errorHttp('Reseña no encontrada.', 404);
    }

    return resena;
}

async function crear(usuario, body) {
    const datos = cuerpo(body);
    const idVideojuego = entero(datos.id_videojuego, 'id_videojuego');
    const idUsuario = Number(usuario.id_usuario);
    const { contenido, etiquetas } = await validarContenido(datos);

    if (!(await videojuegosRepository.buscarPorId(idVideojuego))) {
        throw errorHttp('El videojuego indicado no existe.', 400);
    }

    // Regla de negocio: solo reseña quien compró (y la compra está confirmada).
    const compra = await comprasRepository.buscarPorUsuarioYVideojuego(
        idUsuario,
        idVideojuego
    );

    if (!compra) {
        throw errorHttp('Debes comprar el videojuego antes de reseñarlo.', 403);
    }

    if (compra.estado !== 'confirmada') {
        throw errorHttp(
            `Tu compra debe estar confirmada para reseñar (estado: ${compra.estado}).`,
            403
        );
    }

    if (await resenasRepository.buscarPorUsuarioYVideojuego(idUsuario, idVideojuego)) {
        throw errorHttp('Ya reseñaste este videojuego. Edita tu reseña existente.', 409);
    }

    return resenasRepository.crear(
        { ...contenido, id_usuario: idUsuario, id_videojuego: idVideojuego },
        etiquetas || []
    );
}

/** Solo el autor edita; ni siquiera un admin puede reescribir opiniones ajenas. */
async function actualizar(id, usuario, body) {
    const resena = await obtener(id);

    if (resena.id_usuario !== Number(usuario.id_usuario)) {
        throw errorHttp('Solo el autor puede editar su reseña.', 403);
    }

    const { contenido, etiquetas } = await validarContenido(cuerpo(body));

    return resenasRepository.actualizar(resena.id_resena, contenido, etiquetas);
}

/** El autor o un administrador (moderación) pueden borrarla. */
async function eliminar(id, usuario) {
    const resena = await obtener(id);

    if (!esAdmin(usuario) && resena.id_usuario !== Number(usuario.id_usuario)) {
        throw errorHttp('No tienes permiso para eliminar esta reseña.', 403);
    }

    await resenasRepository.eliminar(resena.id_resena);

    return { mensaje: 'Reseña eliminada correctamente.' };
}

module.exports = {
    listar,
    listarPorVideojuego,
    obtener,
    crear,
    actualizar,
    eliminar
};
