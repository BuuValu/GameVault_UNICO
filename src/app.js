const express = require('express');
const cors = require('cors');

const usuariosRoutes = require('./routes/usuarios.routes');
const videojuegosRoutes = require('./routes/videojuegos.routes');
const generosRoutes = require('./routes/generos.routes');
const etiquetasRoutes = require('./routes/etiquetas.routes');
const logrosRoutes = require('./routes/logros.routes');
const resenasRoutes = require('./routes/resenas.routes');
const progresoRoutes = require('./routes/progreso.routes');
const {
    router: comprasRoutes,
    porUsuario: comprasPorUsuarioRoutes
} = require('./routes/compras.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
    res.status(200).json({
        ok: true,
        mensaje: 'API de GameVault funcionando'
    });
});

app.use('/api/usuarios', usuariosRoutes);
app.use('/api/usuarios/:id/compras', comprasPorUsuarioRoutes);
app.use('/api/usuarios/:id/logros', progresoRoutes);
app.use('/api/videojuegos', videojuegosRoutes);
app.use('/api/generos', generosRoutes);
app.use('/api/etiquetas', etiquetasRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/resenas', resenasRoutes);
app.use('/api/logros', logrosRoutes);


// Documentación interactiva OpenAPI/Swagger (Persona 3).
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi.json');
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, {
    explorer: true,
    customSiteTitle: 'GameVault | Swagger API'
}));

// Ruta inexistente
app.use((req, res) => {
    res.status(404).json({
        error: `La ruta ${req.method} ${req.originalUrl} no existe.`
    });
});

/**
 * Errores de MySQL (mysql2) -> respuesta HTTP.
 * Es la última red de seguridad: los servicios ya validan antes de llegar
 * a la base de datos, pero las restricciones de MySQL siguen protegiendo
 * los datos si dos solicitudes compiten.
 */
const ERRORES_MYSQL = {
    ER_DUP_ENTRY: [409, 'Ya existe un registro con esos datos.'],
    ER_NO_REFERENCED_ROW_2: [400, 'La operación hace referencia a un registro inexistente.'],
    ER_ROW_IS_REFERENCED_2: [409, 'No se puede eliminar o modificar el registro porque otros registros dependen de él.'],
    ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Los datos no cumplen las restricciones de la base de datos.'],
    ER_BAD_NULL_ERROR: [400, 'Falta un dato obligatorio.'],
    ER_DATA_TOO_LONG: [400, 'Un dato supera la longitud permitida.'],
    ER_TRUNCATED_WRONG_VALUE: [400, 'Un dato tiene un formato inválido.'],
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: [400, 'Un dato tiene un formato inválido.'],
    ER_WARN_DATA_OUT_OF_RANGE: [400, 'Un dato está fuera del rango permitido.'],
    ER_LOCK_DEADLOCK: [503, 'Conflicto temporal con otra operación. Intenta de nuevo.'],
    ER_LOCK_WAIT_TIMEOUT: [503, 'La operación tardó demasiado. Intenta de nuevo.'],
    ER_CON_COUNT_ERROR: [503, 'La base de datos no está disponible en este momento.'],
    PROTOCOL_CONNECTION_LOST: [503, 'La base de datos no está disponible en este momento.'],
    ECONNREFUSED: [503, 'La base de datos no está disponible en este momento.'],
    ETIMEDOUT: [503, 'La base de datos no está disponible en este momento.']
};

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    // JSON mal formado o demasiado grande (lo lanza express.json)
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'El cuerpo de la solicitud no es un JSON válido.'
        });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'El cuerpo de la solicitud es demasiado grande.'
        });
    }

    const errorMysql = ERRORES_MYSQL[error.code];

    if (errorMysql) {
        const [status, mensaje] = errorMysql;

        if (status >= 500) {
            console.error(error);
        }

        return res.status(status).json({ error: mensaje });
    }

    // Errores controlados lanzados por los servicios
    if (error.status && error.status < 500) {
        const cuerpoError = { error: error.message };

        if (error.detalles) {
            cuerpoError.detalles = error.detalles;
        }

        return res.status(error.status).json(cuerpoError);
    }

    console.error(error);

    res.status(500).json({
        error: 'Error interno del servidor.'
    });
});

module.exports = app;
