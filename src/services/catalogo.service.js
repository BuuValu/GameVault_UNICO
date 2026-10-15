const { errorHttp } = require('../utils/errores');
const { idDeRuta, cuerpo, textoRequerido } = require('../utils/validaciones');

/**
 * Lógica compartida de los catálogos simples (géneros y etiquetas).
 * El repositorio y los textos se inyectan para poder reutilizarla.
 */
function crearServicioCatalogo({ repositorio, textos, maxNombre }) {
    function leerNombre(datos) {
        return textoRequerido(cuerpo(datos).nombre, 'El nombre', maxNombre);
    }

    async function listar() {
        return repositorio.listar();
    }

    async function obtener(id) {
        const registro = await repositorio.buscarPorId(idDeRuta(id));

        if (!registro) {
            throw errorHttp(textos.noEncontrado, 404);
        }

        return registro;
    }

    async function crear(datos) {
        const nombre = leerNombre(datos);

        if (await repositorio.buscarPorNombre(nombre)) {
            throw errorHttp(textos.duplicado, 409);
        }

        return repositorio.crear(nombre);
    }

    async function actualizar(id, datos) {
        const idValido = idDeRuta(id);
        const nombre = leerNombre(datos);

        if (!(await repositorio.buscarPorId(idValido))) {
            throw errorHttp(textos.noEncontrado, 404);
        }

        const mismoNombre = await repositorio.buscarPorNombre(nombre);

        if (mismoNombre && mismoNombre[textos.pk] !== idValido) {
            throw errorHttp(textos.duplicado, 409);
        }

        return repositorio.actualizar(idValido, nombre);
    }

    async function eliminar(id) {
        const registro = await obtener(id);

        if (registro[textos.campoUso] > 0) {
            throw errorHttp(textos.enUso, 409);
        }

        await repositorio.eliminar(registro[textos.pk]);

        return { mensaje: textos.eliminado };
    }

    /** Devuelve un error 400 si algún ID de la lista no existe. */
    async function exigirExistentes(ids, campo) {
        const existentes = await repositorio.idsExistentes(ids);
        const faltantes = ids.filter((id) => !existentes.includes(id));

        if (faltantes.length > 0) {
            throw errorHttp(
                `${campo} contiene IDs inexistentes: ${faltantes.join(', ')}.`
            );
        }
    }

    return { listar, obtener, crear, actualizar, eliminar, exigirExistentes };
}

module.exports = { crearServicioCatalogo };
