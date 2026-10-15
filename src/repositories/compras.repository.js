const pool = require('../config/db');
const { aEstadoSQL } = require('../config/adaptador-respuestas');

const SELECT_BASE = `
    SELECT c.purchase_id, c.user_id, c.video_game_id, c.purchase_date,
           c.price_paid, c.status,
           v.name AS videojuego_nombre,
           u.name AS usuario_nombre
      FROM purchases c
      JOIN video_games v ON v.video_game_id = c.video_game_id
      JOIN users u ON u.user_id = c.user_id`;

function mapear(fila) {
    return { ...fila, precio_pagado: Number(fila.precio_pagado) };
}

async function listar(filtros) {
    const condiciones = [];
    const parametros = [];

    if (filtros.idUsuario) {
        condiciones.push('c.user_id = ?');
        parametros.push(filtros.idUsuario);
    }

    if (filtros.idVideojuego) {
        condiciones.push('c.video_game_id = ?');
        parametros.push(filtros.idVideojuego);
    }

    if (filtros.estado) {
        condiciones.push('c.status = ?');
        parametros.push(aEstadoSQL(filtros.estado));
    }

    const where = condiciones.length
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM purchases c ${where}`,
        parametros
    );

    const [filas] = await pool.query(
        `${SELECT_BASE} ${where}
         ORDER BY c.purchase_date DESC, c.purchase_id DESC
         LIMIT ? OFFSET ?`,
        [...parametros, filtros.limite, filtros.offset]
    );

    return { total: Number(total), compras: filas.map(mapear) };
}

async function buscarPorId(id) {
    const [filas] = await pool.execute(
        `${SELECT_BASE} WHERE c.purchase_id = ?`,
        [id]
    );

    return filas[0] ? mapear(filas[0]) : null;
}

async function buscarPorUsuarioYVideojuego(idUsuario, idVideojuego) {
    const [filas] = await pool.execute(
        `${SELECT_BASE} WHERE c.user_id = ? AND c.video_game_id = ?`,
        [idUsuario, idVideojuego]
    );

    return filas[0] ? mapear(filas[0]) : null;
}

async function crear({ idUsuario, idVideojuego, precio }) {
    const [resultado] = await pool.execute(
        `INSERT INTO purchases (user_id, video_game_id, price_paid)
         VALUES (?, ?, ?)`,
        [idUsuario, idVideojuego, precio]
    );

    return buscarPorId(resultado.insertId);
}

/**
 * Reintento de una compra fallida: reutiliza la fila (la combinación
 * usuario-videojuego es UNIQUE). La condición estado='failed' evita
 * pisar una compra que otra solicitud ya haya cambiado.
 */
async function reintentar(id, precio) {
    const [resultado] = await pool.execute(
        `UPDATE purchases
            SET status = 'pending', price_paid = ?, purchase_date = NOW()
          WHERE purchase_id = ? AND status = 'failed'`,
        [precio, id]
    );

    return resultado.affectedRows > 0 ? buscarPorId(id) : null;
}

/** Cambio de estado condicionado al estado actual (control de concurrencia). */
async function cambiarEstado(id, estadoActual, estadoNuevo) {
    const [resultado] = await pool.execute(
        `UPDATE purchases SET status = ?
          WHERE purchase_id = ? AND status = ?`,
        [aEstadoSQL(estadoNuevo), id, aEstadoSQL(estadoActual)]
    );

    return resultado.affectedRows > 0 ? buscarPorId(id) : null;
}

async function eliminarPendiente(id) {
    const [resultado] = await pool.execute(
        `DELETE FROM purchases WHERE purchase_id = ? AND status = 'pending'`,
        [id]
    );

    return resultado.affectedRows > 0;
}

module.exports = {
    listar,
    buscarPorId,
    buscarPorUsuarioYVideojuego,
    crear,
    reintentar,
    cambiarEstado,
    eliminarPendiente
};
