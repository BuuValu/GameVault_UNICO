const pool = require('../config/db');

async function buscarPorCorreo(correo) {
    const [filas] = await pool.execute(
        `SELECT user_id, name, email, password, role,
                accepted_terms, registration_date
         FROM users
         WHERE email = ?`,
        [correo]
    );

    return filas[0] || null;
}

async function buscarPorId(id) {
    const [filas] = await pool.execute(
        `SELECT user_id, name, email, role,
                accepted_terms, registration_date
         FROM users
         WHERE user_id = ?`,
        [id]
    );

    return filas[0] || null;
}

async function listar() {
    const [filas] = await pool.execute(
        `SELECT user_id, name, email, role,
                accepted_terms, registration_date
         FROM users
         ORDER BY user_id DESC`
    );

    return filas;
}

async function crear(datos) {
    const [resultado] = await pool.execute(
        `INSERT INTO users
            (name, email, password, role, accepted_terms)
         VALUES (?, ?, ?, 'user', ?)`,
        [
            datos.nombre,
            datos.correo,
            datos.contrasena,
            datos.acepto_terminos
        ]
    );

    return buscarPorId(resultado.insertId);
}

async function actualizar(id, datos) {
    await pool.execute(
        `UPDATE users
         SET name = ?, email = ?
         WHERE user_id = ?`,
        [datos.nombre, datos.correo, id]
    );

    return buscarPorId(id);
}

async function actualizarContrasena(id, contrasena) {
    await pool.execute(
        `UPDATE users
         SET password = ?
         WHERE user_id = ?`,
        [contrasena, id]
    );

    return buscarPorId(id);
}

async function eliminar(id) {
    const [resultado] = await pool.execute(
        'DELETE FROM users WHERE user_id = ?',
        [id]
    );

    return resultado.affectedRows > 0;
}

module.exports = {
    buscarPorCorreo,
    buscarPorId,
    listar,
    crear,
    actualizar,
    actualizarContrasena,
    eliminar
};