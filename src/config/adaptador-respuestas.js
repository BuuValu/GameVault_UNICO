/** Traducción de nombres y ENUM entre el esquema MySQL en inglés y la API pública en español.
 * Se preservan los contratos JSON que utiliza Swagger y los controladores originales.
 * La traducción se aplica únicamente a filas SELECT, nunca a ResultSetHeader.
 */
const nombres = Object.freeze({
    "user_id": "id_usuario",
    "video_game_id": "id_videojuego",
    "genre_id": "id_genero",
    "tag_id": "id_etiqueta",
    "purchase_id": "id_compra",
    "review_id": "id_resena",
    "achievement_id": "id_logro",
    "name": "nombre",
    "email": "correo",
    "password": "contrasena",
    "role": "rol",
    "accepted_terms": "acepto_terminos",
    "registration_date": "fecha_registro",
    "image_url": "imagen_url",
    "description": "descripcion",
    "price": "precio",
    "age_rating": "clasificacion_edad",
    "is_active": "activo",
    "purchase_date": "fecha_compra",
    "price_paid": "precio_pagado",
    "status": "estado",
    "rating": "calificacion",
    "comment": "comentario",
    "hours_played": "horas_jugadas",
    "review_date": "fecha_resena",
    "type": "tipo",
    "target": "meta",
    "progress": "progreso",
    "is_unlocked": "desbloqueado",
    "unlock_date": "fecha_desbloqueo"
});
const roles = { user: 'usuario', administrator: 'administrador' };
const estados = { pending: 'pendiente', confirmed: 'confirmada', failed: 'fallida' };
const tipos = { simple: 'simple', progress: 'progreso', date: 'fecha' };

function adaptarFila(fila) {
    const salida = {};
    for (const [clave, valor] of Object.entries(fila)) {
        const nombre = nombres[clave] || clave;
        let traducido = valor;
        if (clave === 'role') traducido = roles[valor] || valor;
        if (clave === 'status') traducido = estados[valor] || valor;
        if (clave === 'type') traducido = tipos[valor] || valor;
        salida[nombre] = traducido;
    }
    return salida;
}
function adaptarResultado(resultado) {
    if (!Array.isArray(resultado)) return resultado;
    const [filas, metadatos] = resultado;
    if (!Array.isArray(filas)) return resultado;
    return [filas.map(adaptarFila), metadatos];
}
const aEstadoSQL = (estado) => ({ pendiente: 'pending', confirmada: 'confirmed', fallida: 'failed' })[estado] || estado;
const aTipoSQL = (tipo) => ({ simple: 'simple', progreso: 'progress', fecha: 'date' })[tipo] || tipo;
module.exports = { adaptarResultado, aEstadoSQL, aTipoSQL };
