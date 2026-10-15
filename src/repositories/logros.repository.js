const pool = require('../config/db');
const { aTipoSQL } = require('../config/adaptador-respuestas');

function mapear(fila) {
    return { ...fila, meta: fila.meta === null ? null : Number(fila.meta) };
}

async function listarPorVideojuego(idVideojuego) {
    const [filas] = await pool.execute(
        `SELECT achievement_id, video_game_id, name, description, type, target
           FROM achievements
          WHERE video_game_id = ?
          ORDER BY achievement_id`,
        [idVideojuego]
    );

    return filas.map(mapear);
}

async function buscarPorId(id) {
    const [filas] = await pool.execute(
        `SELECT achievement_id, video_game_id, name, description, type, target
           FROM achievements
          WHERE achievement_id = ?`,
        [id]
    );

    return filas[0] ? mapear(filas[0]) : null;
}

async function buscarPorNombre(idVideojuego, nombre) {
    const [filas] = await pool.execute(
        `SELECT achievement_id FROM achievements
          WHERE video_game_id = ? AND name = ?`,
        [idVideojuego, nombre]
    );

    return filas[0] || null;
}

async function crear(idVideojuego, datos) {
    const [resultado] = await pool.execute(
        `INSERT INTO achievements (video_game_id, name, description, type, target)
         VALUES (?, ?, ?, ?, ?)`,
        [idVideojuego, datos.nombre, datos.descripcion, aTipoSQL(datos.tipo), datos.meta]
    );

    return buscarPorId(resultado.insertId);
}

async function actualizar(id, datos) {
    await pool.execute(
        `UPDATE achievements
            SET name = ?, description = ?, type = ?, target = ?
          WHERE achievement_id = ?`,
        [datos.nombre, datos.descripcion, aTipoSQL(datos.tipo), datos.meta, id]
    );

    return buscarPorId(id);
}

async function eliminar(id) {
    const [resultado] = await pool.execute(
        'DELETE FROM achievements WHERE achievement_id = ?',
        [id]
    );

    return resultado.affectedRows > 0;
}

module.exports = {
    listarPorVideojuego,
    buscarPorId,
    buscarPorNombre,
    crear,
    actualizar,
    eliminar
};
