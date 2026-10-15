const pool = require('../config/db');
const { conTransaccion } = require('../utils/transaccion');

// No se expone el correo del autor: las reseñas son públicas.
const SELECT_BASE = `
    SELECT r.review_id, r.user_id, u.name AS usuario_nombre,
           r.video_game_id, v.name AS videojuego_nombre,
           r.rating, r.comment, r.hours_played, r.review_date
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      JOIN video_games v ON v.video_game_id = r.video_game_id`;

function mapear(fila) {
    return {
        ...fila,
        horas_jugadas: fila.horas_jugadas === null
            ? null
            : Number(fila.horas_jugadas)
    };
}

async function adjuntarEtiquetas(resenas) {
    if (resenas.length === 0) {
        return resenas;
    }

    const [filas] = await pool.query(
        `SELECT re.review_id, e.tag_id, e.name
           FROM review_tags re
           JOIN tags e ON e.tag_id = re.tag_id
          WHERE re.review_id IN (?)
          ORDER BY e.name`,
        [resenas.map((r) => r.id_resena)]
    );

    return resenas.map((resena) => ({
        ...resena,
        etiquetas: filas
            .filter((fila) => fila.id_resena === resena.id_resena)
            .map(({ id_etiqueta, nombre }) => ({ id_etiqueta, nombre }))
    }));
}

async function listar(filtros) {
    const condiciones = [];
    const parametros = [];

    if (filtros.idVideojuego) {
        condiciones.push('r.video_game_id = ?');
        parametros.push(filtros.idVideojuego);
    }

    if (filtros.idUsuario) {
        condiciones.push('r.user_id = ?');
        parametros.push(filtros.idUsuario);
    }

    if (filtros.calificacion) {
        condiciones.push('r.rating = ?');
        parametros.push(filtros.calificacion);
    }

    const where = condiciones.length
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM reviews r ${where}`,
        parametros
    );

    const [filas] = await pool.query(
        `${SELECT_BASE} ${where}
         ORDER BY r.review_date DESC, r.review_id DESC
         LIMIT ? OFFSET ?`,
        [...parametros, filtros.limite, filtros.offset]
    );

    return {
        total: Number(total),
        resenas: await adjuntarEtiquetas(filas.map(mapear))
    };
}

async function buscarPorId(id) {
    const [filas] = await pool.execute(
        `${SELECT_BASE} WHERE r.review_id = ?`,
        [id]
    );

    if (filas.length === 0) {
        return null;
    }

    const [resena] = await adjuntarEtiquetas([mapear(filas[0])]);
    return resena;
}

async function buscarPorUsuarioYVideojuego(idUsuario, idVideojuego) {
    const [filas] = await pool.execute(
        `SELECT review_id FROM reviews
          WHERE user_id = ? AND video_game_id = ?`,
        [idUsuario, idVideojuego]
    );

    return filas[0] || null;
}

async function reemplazarEtiquetas(conexion, idResena, etiquetas) {
    await conexion.execute(
        'DELETE FROM review_tags WHERE review_id = ?',
        [idResena]
    );

    if (etiquetas.length > 0) {
        await conexion.query(
            'INSERT INTO review_tags (review_id, tag_id) VALUES ?',
            [etiquetas.map((idEtiqueta) => [idResena, idEtiqueta])]
        );
    }
}

/** La reseña y sus etiquetas se guardan juntas o no se guarda nada. */
async function crear(datos, etiquetas = []) {
    const id = await conTransaccion(async (conexion) => {
        const [resultado] = await conexion.execute(
            `INSERT INTO reviews
                (user_id, video_game_id, rating,
                 comment, hours_played)
             VALUES (?, ?, ?, ?, ?)`,
            [
                datos.id_usuario,
                datos.id_videojuego,
                datos.calificacion,
                datos.comentario,
                datos.horas_jugadas
            ]
        );

        await reemplazarEtiquetas(conexion, resultado.insertId, etiquetas);

        return resultado.insertId;
    });

    return buscarPorId(id);
}

/** `tags` undefined = conservar las actuales. */
async function actualizar(id, datos, etiquetas) {
    await conTransaccion(async (conexion) => {
        await conexion.execute(
            `UPDATE reviews
                SET rating = ?, comment = ?, hours_played = ?
              WHERE review_id = ?`,
            [datos.calificacion, datos.comentario, datos.horas_jugadas, id]
        );

        if (etiquetas !== undefined) {
            await reemplazarEtiquetas(conexion, id, etiquetas);
        }
    });

    return buscarPorId(id);
}

async function eliminar(id) {
    const [resultado] = await pool.execute(
        'DELETE FROM reviews WHERE review_id = ?',
        [id]
    );

    return resultado.affectedRows > 0;
}

module.exports = {
    listar,
    buscarPorId,
    buscarPorUsuarioYVideojuego,
    crear,
    actualizar,
    eliminar
};
