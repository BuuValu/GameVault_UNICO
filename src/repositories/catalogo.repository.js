const pool = require('../config/db');

/**
 * Los géneros y las etiquetas son catálogos idénticos (id + nombre único),
 * así que comparten esta fábrica. Los nombres de tabla/columna vienen de
 * constantes del código, nunca del cliente.
 */
function crearRepositorioCatalogo({ tabla, pk, usoTabla, campoUso }) {
    const columnas = `t.${pk}, t.name,
        (SELECT COUNT(*) FROM ${usoTabla} u WHERE u.${pk} = t.${pk}) AS ${campoUso}`;

    async function listar() {
        const [filas] = await pool.execute(
            `SELECT ${columnas} FROM ${tabla} t ORDER BY t.name`
        );
        return filas;
    }

    async function buscarPorId(id) {
        const [filas] = await pool.execute(
            `SELECT ${columnas} FROM ${tabla} t WHERE t.${pk} = ?`,
            [id]
        );
        return filas[0] || null;
    }

    async function buscarPorNombre(nombre) {
        const [filas] = await pool.execute(
            `SELECT ${pk}, name FROM ${tabla} WHERE name = ?`,
            [nombre]
        );
        return filas[0] || null;
    }

    async function crear(nombre) {
        const [resultado] = await pool.execute(
            `INSERT INTO ${tabla} (name) VALUES (?)`,
            [nombre]
        );
        return buscarPorId(resultado.insertId);
    }

    async function actualizar(id, nombre) {
        await pool.execute(
            `UPDATE ${tabla} SET name = ? WHERE ${pk} = ?`,
            [nombre, id]
        );
        return buscarPorId(id);
    }

    async function eliminar(id) {
        const [resultado] = await pool.execute(
            `DELETE FROM ${tabla} WHERE ${pk} = ?`,
            [id]
        );
        return resultado.affectedRows > 0;
    }

    /** Devuelve los IDs de la lista que SÍ existen en la tabla. */
    async function idsExistentes(ids) {
        if (ids.length === 0) {
            return [];
        }

        const [filas] = await pool.query(
            `SELECT ${pk} FROM ${tabla} WHERE ${pk} IN (?)`,
            [ids]
        );
        // mysql2 ya devolvió las columnas normalizadas para la API pública.
        const pkApi = { genre_id: 'id_genero', tag_id: 'id_etiqueta' }[pk] || pk;
        return filas.map((fila) => fila[pkApi]);
    }

    return {
        listar,
        buscarPorId,
        buscarPorNombre,
        crear,
        actualizar,
        eliminar,
        idsExistentes
    };
}

module.exports = { crearRepositorioCatalogo };
