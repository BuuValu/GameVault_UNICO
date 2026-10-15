const pool = require('../config/db');
const { conTransaccion } = require('../utils/transaccion');

const SELECT_BASE = `
    SELECT v.video_game_id, v.name, v.image_url, v.description,
           v.price, v.age_rating, v.is_active,
           (SELECT ROUND(AVG(r.rating), 2)
              FROM reviews r
             WHERE r.video_game_id = v.video_game_id) AS promedio_calificacion,
           (SELECT COUNT(*)
              FROM reviews r
             WHERE r.video_game_id = v.video_game_id) AS total_resenas
      FROM video_games v`;

// Lista blanca: el cliente nunca controla el texto del ORDER BY.
const ORDENES = {
    nombre: 'v.name ASC',
    precio_asc: 'v.price ASC, v.name ASC',
    precio_desc: 'v.price DESC, v.name ASC',
    recientes: 'v.video_game_id DESC',
    mejor_calificados: 'promedio_calificacion DESC, total_resenas DESC, v.name ASC'
};

function mapear(fila) {
    return {
        id_videojuego: fila.id_videojuego,
        nombre: fila.nombre,
        imagen_url: fila.imagen_url,
        descripcion: fila.descripcion,
        precio: Number(fila.precio),
        clasificacion_edad: fila.clasificacion_edad,
        activo: Boolean(fila.activo),
        promedio_calificacion: fila.promedio_calificacion === null
            ? null
            : Number(fila.promedio_calificacion),
        total_resenas: Number(fila.total_resenas)
    };
}

async function adjuntarGeneros(videojuegos) {
    if (videojuegos.length === 0) {
        return videojuegos;
    }

    const [filas] = await pool.query(
        `SELECT vg.video_game_id, g.genre_id, g.name
           FROM video_game_genres vg
           JOIN genres g ON g.genre_id = vg.genre_id
          WHERE vg.video_game_id IN (?)
          ORDER BY g.name`,
        [videojuegos.map((v) => v.id_videojuego)]
    );

    return videojuegos.map((videojuego) => ({
        ...videojuego,
        generos: filas
            .filter((fila) => fila.id_videojuego === videojuego.id_videojuego)
            .map(({ id_genero, nombre }) => ({ id_genero, nombre }))
    }));
}

async function listar(filtros) {
    const condiciones = [];
    const parametros = [];

    if (filtros.activo !== undefined) {
        condiciones.push('v.is_active = ?');
        parametros.push(filtros.activo ? 1 : 0);
    }

    if (filtros.q) {
        condiciones.push('v.name LIKE ?');
        parametros.push(`%${filtros.q.replace(/[\\%_]/g, '\\$&')}%`);
    }

    if (filtros.genero) {
        condiciones.push(
            `EXISTS (SELECT 1 FROM video_game_genres vg
                      WHERE vg.video_game_id = v.video_game_id
                        AND vg.genre_id = ?)`
        );
        parametros.push(filtros.genero);
    }

    if (filtros.precioMin !== undefined) {
        condiciones.push('v.price >= ?');
        parametros.push(filtros.precioMin);
    }

    if (filtros.precioMax !== undefined) {
        condiciones.push('v.price <= ?');
        parametros.push(filtros.precioMax);
    }

    const where = condiciones.length
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM video_games v ${where}`,
        parametros
    );

    const [filas] = await pool.query(
        `${SELECT_BASE} ${where}
         ORDER BY ${ORDENES[filtros.orden] || ORDENES.nombre}
         LIMIT ? OFFSET ?`,
        [...parametros, filtros.limite, filtros.offset]
    );

    return {
        total: Number(total),
        videojuegos: await adjuntarGeneros(filas.map(mapear))
    };
}

async function buscarPorId(id) {
    const [filas] = await pool.execute(
        `${SELECT_BASE} WHERE v.video_game_id = ?`,
        [id]
    );

    if (filas.length === 0) {
        return null;
    }

    const [videojuego] = await adjuntarGeneros([mapear(filas[0])]);
    return videojuego;
}

async function buscarPorNombre(nombre) {
    const [filas] = await pool.execute(
        'SELECT video_game_id, name FROM video_games WHERE name = ?',
        [nombre]
    );

    return filas[0] || null;
}

async function reemplazarGeneros(conexion, idVideojuego, generos) {
    await conexion.execute(
        'DELETE FROM video_game_genres WHERE video_game_id = ?',
        [idVideojuego]
    );

    if (generos.length > 0) {
        await conexion.query(
            'INSERT INTO video_game_genres (video_game_id, genre_id) VALUES ?',
            [generos.map((idGenero) => [idVideojuego, idGenero])]
        );
    }
}

async function crear(datos, generos = []) {
    const id = await conTransaccion(async (conexion) => {
        const [resultado] = await conexion.execute(
            `INSERT INTO video_games
                (name, image_url, description, price,
                 age_rating, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                datos.nombre,
                datos.imagen_url,
                datos.descripcion,
                datos.precio,
                datos.clasificacion_edad,
                datos.activo ? 1 : 0
            ]
        );

        if (generos.length > 0) {
            await conexion.query(
                'INSERT INTO video_game_genres (video_game_id, genre_id) VALUES ?',
                [generos.map((idGenero) => [resultado.insertId, idGenero])]
            );
        }

        return resultado.insertId;
    });

    return buscarPorId(id);
}

/** `genres` undefined = no tocar los géneros actuales. */
async function actualizar(id, datos, generos) {
    await conTransaccion(async (conexion) => {
        await conexion.execute(
            `UPDATE video_games
                SET name = ?, image_url = ?, description = ?,
                    price = ?, age_rating = ?, is_active = ?
              WHERE video_game_id = ?`,
            [
                datos.nombre,
                datos.imagen_url,
                datos.descripcion,
                datos.precio,
                datos.clasificacion_edad,
                datos.activo ? 1 : 0,
                id
            ]
        );

        if (generos !== undefined) {
            await reemplazarGeneros(conexion, id, generos);
        }
    });

    return buscarPorId(id);
}

async function eliminar(id) {
    const [resultado] = await pool.execute(
        'DELETE FROM video_games WHERE video_game_id = ?',
        [id]
    );

    return resultado.affectedRows > 0;
}

async function tieneCompras(id) {
    const [filas] = await pool.execute(
        'SELECT 1 FROM purchases WHERE video_game_id = ? LIMIT 1',
        [id]
    );

    return filas.length > 0;
}

/** Relación N:M. Devuelve true si se creó, false si ya existía. */
async function agregarGenero(idVideojuego, idGenero) {
    const [resultado] = await pool.execute(
        `INSERT IGNORE INTO video_game_genres (video_game_id, genre_id)
         VALUES (?, ?)`,
        [idVideojuego, idGenero]
    );

    return resultado.affectedRows > 0;
}

async function quitarGenero(idVideojuego, idGenero) {
    const [resultado] = await pool.execute(
        `DELETE FROM video_game_genres
          WHERE video_game_id = ? AND genre_id = ?`,
        [idVideojuego, idGenero]
    );

    return resultado.affectedRows > 0;
}

module.exports = {
    listar,
    buscarPorId,
    buscarPorNombre,
    crear,
    actualizar,
    eliminar,
    tieneCompras,
    agregarGenero,
    quitarGenero
};
