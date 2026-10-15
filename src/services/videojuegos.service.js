const videojuegosRepository = require('../repositories/videojuegos.repository');
const generosRepository = require('../repositories/generos.repository');
const generosService = require('./generos.service');
const { errorHttp } = require('../utils/errores');
const {
    cuerpo,
    idDeRuta,
    textoRequerido,
    textoOpcional,
    urlOpcional,
    decimalNoNegativo,
    booleano,
    listaDeIds,
    paginacion,
    respuestaPaginada
} = require('../utils/validaciones');

// Regla de negocio centralizada: cambiar aquí si el equipo usa otro sistema.
const CLASIFICACIONES = ['TODOS', '3+', '7+', '12+', '16+', '18+'];
const ORDENES = ['nombre', 'precio_asc', 'precio_desc', 'recientes', 'mejor_calificados'];
const CAMPOS = [
    'nombre', 'imagen_url', 'descripcion', 'precio',
    'clasificacion_edad', 'activo', 'generos'
];

const esAdmin = (usuario) => Boolean(usuario) && usuario.rol === 'administrador';

function validarClasificacion(valor) {
    const texto = typeof valor === 'string' ? valor.trim().toUpperCase() : '';

    if (!CLASIFICACIONES.includes(texto)) {
        throw errorHttp(
            `clasificacion_edad debe ser una de: ${CLASIFICACIONES.join(', ')}.`
        );
    }

    return texto;
}

/** Valida y normaliza un videojuego completo (POST, PUT y PATCH ya fusionado). */
function validarVideojuego(datos) {
    return {
        nombre: textoRequerido(datos.nombre, 'El nombre', 150),
        imagen_url: urlOpcional(datos.imagen_url, 'imagen_url'),
        descripcion: textoRequerido(datos.descripcion, 'La descripción', 5000),
        precio: decimalNoNegativo(datos.precio, 'El precio'),
        clasificacion_edad: validarClasificacion(datos.clasificacion_edad),
        activo: datos.activo === undefined
            ? true
            : booleano(datos.activo, 'activo')
    };
}

async function validarGeneros(datos) {
    if (datos.generos === undefined) {
        return undefined;
    }

    const ids = listaDeIds(datos.generos, 'generos');
    await generosService.exigirExistentes(ids, 'generos');

    return ids;
}

async function exigirNombreLibre(nombre, idActual) {
    const existente = await videojuegosRepository.buscarPorNombre(nombre);

    if (existente && existente.id_videojuego !== idActual) {
        throw errorHttp('Ya existe un videojuego con ese nombre.', 409);
    }
}

function leerFiltros(consulta, usuario) {
    const { pagina, limite, offset } = paginacion(consulta);
    const filtros = { pagina, limite, offset };

    // El público solo ve el catálogo activo; el admin puede filtrar.
    if (!esAdmin(usuario)) {
        filtros.activo = true;
    } else if (consulta.activo !== undefined && consulta.activo !== 'todos') {
        if (!['true', 'false'].includes(consulta.activo)) {
            throw errorHttp('activo debe ser true, false o todos.');
        }
        filtros.activo = consulta.activo === 'true';
    }

    if (consulta.q !== undefined) {
        filtros.q = textoOpcional(String(consulta.q), 'q', 100) || undefined;
    }

    if (consulta.genero !== undefined) {
        filtros.genero = idDeRuta(consulta.genero, 'genero');
    }

    for (const [clave, campo] of [['precio_min', 'precioMin'], ['precio_max', 'precioMax']]) {
        if (consulta[clave] !== undefined) {
            const numero = Number(consulta[clave]);

            if (consulta[clave] === '' || !Number.isFinite(numero) || numero < 0) {
                throw errorHttp(`${clave} debe ser un número mayor o igual a 0.`);
            }

            filtros[campo] = numero;
        }
    }

    if (
        filtros.precioMin !== undefined &&
        filtros.precioMax !== undefined &&
        filtros.precioMin > filtros.precioMax
    ) {
        throw errorHttp('precio_min no puede ser mayor que precio_max.');
    }

    if (consulta.orden !== undefined) {
        if (!ORDENES.includes(consulta.orden)) {
            throw errorHttp(`orden debe ser uno de: ${ORDENES.join(', ')}.`);
        }
        filtros.orden = consulta.orden;
    }

    return filtros;
}

async function listar(consulta, usuario) {
    const filtros = leerFiltros(consulta, usuario);
    const { total, videojuegos } = await videojuegosRepository.listar(filtros);

    return respuestaPaginada(videojuegos, total, filtros);
}

async function obtener(id, usuario) {
    const videojuego = await videojuegosRepository.buscarPorId(idDeRuta(id));

    // Un juego desactivado "no existe" para el público.
    if (!videojuego || (!videojuego.activo && !esAdmin(usuario))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    return videojuego;
}

async function crear(body) {
    const datos = cuerpo(body);
    const videojuego = validarVideojuego(datos);
    const generos = await validarGeneros(datos);

    await exigirNombreLibre(videojuego.nombre);

    return videojuegosRepository.crear(videojuego, generos || []);
}

async function reemplazar(id, body) {
    const idValido = idDeRuta(id);
    const datos = cuerpo(body);
    const actual = await videojuegosRepository.buscarPorId(idValido);

    if (!actual) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    // PUT: `activo` omitido conserva el valor actual.
    const videojuego = validarVideojuego({
        ...datos,
        activo: datos.activo === undefined ? actual.activo : datos.activo
    });
    const generos = await validarGeneros(datos);

    await exigirNombreLibre(videojuego.nombre, idValido);

    return videojuegosRepository.actualizar(idValido, videojuego, generos);
}

async function actualizarParcial(id, body) {
    const idValido = idDeRuta(id);
    const datos = cuerpo(body);

    if (!CAMPOS.some((campo) => datos[campo] !== undefined)) {
        throw errorHttp(`Debes enviar al menos uno de: ${CAMPOS.join(', ')}.`);
    }

    const actual = await videojuegosRepository.buscarPorId(idValido);

    if (!actual) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    const videojuego = validarVideojuego({ ...actual, ...datos });
    const generos = await validarGeneros(datos);

    await exigirNombreLibre(videojuego.nombre, idValido);

    return videojuegosRepository.actualizar(idValido, videojuego, generos);
}

async function eliminar(id) {
    const idValido = idDeRuta(id);

    if (!(await videojuegosRepository.buscarPorId(idValido))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    if (await videojuegosRepository.tieneCompras(idValido)) {
        throw errorHttp(
            'No se puede eliminar un videojuego con compras registradas. Desactívalo con PATCH (activo: false).',
            409
        );
    }

    await videojuegosRepository.eliminar(idValido);

    return { mensaje: 'Videojuego eliminado correctamente.' };
}

async function listarGeneros(id, usuario) {
    const videojuego = await obtener(id, usuario);
    return videojuego.generos;
}

async function agregarGenero(id, idGenero) {
    const idVideojuego = idDeRuta(id);
    const idGeneroValido = idDeRuta(idGenero, 'El ID del género');

    if (!(await videojuegosRepository.buscarPorId(idVideojuego))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    if (!(await generosRepository.buscarPorId(idGeneroValido))) {
        throw errorHttp('Género no encontrado.', 404);
    }

    const creado = await videojuegosRepository.agregarGenero(
        idVideojuego,
        idGeneroValido
    );
    const videojuego = await videojuegosRepository.buscarPorId(idVideojuego);

    return { creado, generos: videojuego.generos };
}

async function quitarGenero(id, idGenero) {
    const idVideojuego = idDeRuta(id);
    const idGeneroValido = idDeRuta(idGenero, 'El ID del género');

    if (!(await videojuegosRepository.buscarPorId(idVideojuego))) {
        throw errorHttp('Videojuego no encontrado.', 404);
    }

    const quitado = await videojuegosRepository.quitarGenero(
        idVideojuego,
        idGeneroValido
    );

    if (!quitado) {
        throw errorHttp('El videojuego no tiene asociado ese género.', 404);
    }

    return { mensaje: 'Género quitado del videojuego.' };
}

module.exports = {
    listar,
    obtener,
    crear,
    reemplazar,
    actualizarParcial,
    eliminar,
    listarGeneros,
    agregarGenero,
    quitarGenero
};
