const { errorHttp } = require('./errores');

const MAX_PRECIO = 99999999.99; // DECIMAL(10,2)

function esObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

/** Express 5 deja req.body en undefined si no llega JSON. */
function cuerpo(body) {
    if (body === undefined || body === null) {
        return {};
    }

    if (!esObjeto(body)) {
        throw errorHttp('El cuerpo de la solicitud debe ser un objeto JSON.');
    }

    return body;
}

function idDeRuta(valor, nombre = 'ID') {
    const texto = String(valor);
    const numero = Number(texto);

    if (!/^\d+$/.test(texto) || !Number.isSafeInteger(numero) || numero <= 0) {
        throw errorHttp(`${nombre} debe ser un número entero positivo.`);
    }

    return numero;
}

function entero(valor, campo, { min = 1, max = 2147483647 } = {}) {
    if (!Number.isInteger(valor) || valor < min || valor > max) {
        throw errorHttp(`${campo} debe ser un entero entre ${min} y ${max}.`);
    }

    return valor;
}

function textoRequerido(valor, campo, max) {
    if (typeof valor !== 'string' || !valor.trim()) {
        throw errorHttp(`${campo} es obligatorio.`);
    }

    const limpio = valor.trim();

    if (limpio.length > max) {
        throw errorHttp(`${campo} no puede superar ${max} caracteres.`);
    }

    return limpio;
}

function textoOpcional(valor, campo, max) {
    if (valor === undefined || valor === null) {
        return null;
    }

    if (typeof valor !== 'string') {
        throw errorHttp(`${campo} debe ser texto.`);
    }

    const limpio = valor.trim();

    if (limpio.length > max) {
        throw errorHttp(`${campo} no puede superar ${max} caracteres.`);
    }

    return limpio === '' ? null : limpio;
}

function decimalNoNegativo(valor, campo, max = MAX_PRECIO) {
    const valido =
        typeof valor === 'number' &&
        Number.isFinite(valor) &&
        valor >= 0 &&
        valor <= max &&
        Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;

    if (!valido) {
        throw errorHttp(
            `${campo} debe ser un número entre 0 y ${max} con máximo 2 decimales.`
        );
    }

    return valor;
}

function booleano(valor, campo) {
    if (typeof valor !== 'boolean') {
        throw errorHttp(`${campo} debe ser true o false.`);
    }

    return valor;
}

function urlOpcional(valor, campo, max = 500) {
    const texto = textoOpcional(valor, campo, max);

    if (texto === null) {
        return null;
    }

    try {
        const url = new URL(texto);

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('protocolo');
        }
    } catch (error) {
        throw errorHttp(`${campo} debe ser una URL http o https válida.`);
    }

    return texto;
}

/** Valida un arreglo de IDs, sin repetidos. */
function listaDeIds(valor, campo, maxElementos = 20) {
    if (!Array.isArray(valor)) {
        throw errorHttp(`${campo} debe ser un arreglo de IDs.`);
    }

    if (valor.length > maxElementos) {
        throw errorHttp(`${campo} admite máximo ${maxElementos} elementos.`);
    }

    const ids = valor.map((id) => entero(id, `Cada elemento de ${campo}`));

    return [...new Set(ids)];
}

function paginacion(consulta) {
    const pagina = consulta.pagina === undefined
        ? 1
        : Number(consulta.pagina);
    const limite = consulta.limite === undefined
        ? 20
        : Number(consulta.limite);

    if (!Number.isInteger(pagina) || pagina < 1) {
        throw errorHttp('pagina debe ser un entero mayor o igual a 1.');
    }

    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        throw errorHttp('limite debe ser un entero entre 1 y 100.');
    }

    return { pagina, limite, offset: (pagina - 1) * limite };
}

function respuestaPaginada(datos, total, { pagina, limite }) {
    return {
        datos,
        paginacion: {
            pagina,
            limite,
            total,
            paginas: Math.max(1, Math.ceil(total / limite))
        }
    };
}

module.exports = {
    cuerpo,
    idDeRuta,
    entero,
    textoRequerido,
    textoOpcional,
    decimalNoNegativo,
    booleano,
    urlOpcional,
    listaDeIds,
    paginacion,
    respuestaPaginada
};
