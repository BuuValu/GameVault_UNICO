const pool = require('../config/db');

const SELECT_BASE = `
    SELECT p.user_id, p.achievement_id, p.progress, p.is_unlocked,
           p.unlock_date,
           l.video_game_id, l.name AS logro_nombre, l.type, l.target
      FROM achievement_progress p
      JOIN achievements l ON l.achievement_id = p.achievement_id`;

function mapear(fila) {
    return {
        ...fila,
        desbloqueado: Boolean(fila.desbloqueado),
        meta: fila.meta === null ? null : Number(fila.meta)
    };
}

async function listarPorUsuario(idUsuario, idVideojuego) {
    const parametros = [idUsuario];
    let filtro = '';

    if (idVideojuego) {
        filtro = 'AND l.video_game_id = ?';
        parametros.push(idVideojuego);
    }

    const [filas] = await pool.execute(
        `${SELECT_BASE}
          WHERE p.user_id = ? ${filtro}
          ORDER BY l.video_game_id, p.achievement_id`,
        parametros
    );

    return filas.map(mapear);
}

async function buscar(idUsuario, idLogro) {
    const [filas] = await pool.execute(
        `${SELECT_BASE} WHERE p.user_id = ? AND p.achievement_id = ?`,
        [idUsuario, idLogro]
    );

    return filas[0] ? mapear(filas[0]) : null;
}

/** Crea o actualiza el progreso (la PK es usuario + logro). */
async function guardar({ idUsuario, idLogro, progreso, desbloqueado, fechaDesbloqueo }) {
    await pool.execute(
        `INSERT INTO achievement_progress
            (user_id, achievement_id, progress, is_unlocked, unlock_date)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            progress = VALUES(progress),
            is_unlocked = VALUES(is_unlocked),
            unlock_date = VALUES(unlock_date)`,
        [idUsuario, idLogro, progreso, desbloqueado ? 1 : 0, fechaDesbloqueo]
    );

    return buscar(idUsuario, idLogro);
}

async function eliminar(idUsuario, idLogro) {
    const [resultado] = await pool.execute(
        'DELETE FROM achievement_progress WHERE user_id = ? AND achievement_id = ?',
        [idUsuario, idLogro]
    );

    return resultado.affectedRows > 0;
}

async function contarPorLogro(idLogro) {
    const [[{ total }]] = await pool.execute(
        'SELECT COUNT(*) AS total FROM achievement_progress WHERE achievement_id = ?',
        [idLogro]
    );

    return Number(total);
}

module.exports = {
    listarPorUsuario,
    buscar,
    guardar,
    eliminar,
    contarPorLogro
};
