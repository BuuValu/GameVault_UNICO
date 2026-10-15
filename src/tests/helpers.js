// Utilidades compartidas por las pruebas: tokens y datos de ejemplo.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto_de_prueba';

const jwt = require('jsonwebtoken');

function firmar(payload) {
    return `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

// Usuarios de prueba: el 1 es administrador, el 2 (Ana) y el 3 (Beto) son usuarios.
const tokens = {
    admin: firmar({ id_usuario: 1, rol: 'administrador' }),
    ana: firmar({ id_usuario: 2, rol: 'usuario' }),
    beto: firmar({ id_usuario: 3, rol: 'usuario' }),
    invalido: 'Bearer token.falso.xyz'
};

const videojuego = {
    id_videojuego: 1,
    nombre: 'Zelda',
    imagen_url: null,
    descripcion: 'Aventura épica',
    precio: 59.99,
    clasificacion_edad: '12+',
    activo: true,
    promedio_calificacion: null,
    total_resenas: 0,
    generos: [{ id_genero: 1, nombre: 'Acción' }]
};

const compra = {
    id_compra: 10,
    id_usuario: 2,
    id_videojuego: 1,
    fecha_compra: '2026-10-01T10:00:00.000Z',
    precio_pagado: 59.99,
    estado: 'confirmada',
    videojuego_nombre: 'Zelda',
    usuario_nombre: 'Ana'
};

const resena = {
    id_resena: 5,
    id_usuario: 2,
    usuario_nombre: 'Ana',
    id_videojuego: 1,
    videojuego_nombre: 'Zelda',
    calificacion: 4,
    comentario: 'Muy bueno',
    horas_jugadas: 12.5,
    fecha_resena: '2026-10-02T10:00:00.000Z',
    etiquetas: [{ id_etiqueta: 1, nombre: 'Divertido' }]
};

const logro = {
    id_logro: 7,
    id_videojuego: 1,
    nombre: 'Coleccionista',
    descripcion: 'Reúne 10 objetos',
    tipo: 'progreso',
    meta: 10
};

const logroSimple = {
    id_logro: 8,
    id_videojuego: 1,
    nombre: 'Primer paso',
    descripcion: 'Empieza el juego',
    tipo: 'simple',
    meta: null
};

/** Error con el formato que entrega mysql2. */
function errorMysql(code, message = code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

module.exports = {
    tokens,
    videojuego,
    compra,
    resena,
    logro,
    logroSimple,
    errorMysql
};
