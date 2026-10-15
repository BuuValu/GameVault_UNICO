const pool = require('../config/db');

/**
 * Ejecuta `trabajo(conexion)` dentro de una transacción de MySQL.
 * Si algo falla se hace ROLLBACK y el error se propaga al manejador global.
 */
async function conTransaccion(trabajo) {
    const conexion = await pool.getConnection();

    try {
        await conexion.beginTransaction();
        const resultado = await trabajo(conexion);
        await conexion.commit();
        return resultado;
    } catch (error) {
        try {
            await conexion.rollback();
        } catch (errorRollback) {
            // Se ignora: lo importante es propagar el error original.
        }
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = { conTransaccion };
