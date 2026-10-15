
const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
    const encabezado = req.headers.authorization;

    if (!encabezado || !encabezado.startsWith('Bearer ')) {
        return res.status(401).json({
            mensaje: 'Debes iniciar sesión para acceder a este recurso.'
        });
    }

    const token = encabezado.split(' ')[1];

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            mensaje: 'Token inválido o expirado.'
        });
    }
}

function soloAdministrador(req, res, next) {
    if (!req.usuario || req.usuario.rol !== 'administrador') {
        return res.status(403).json({
            mensaje: 'No tienes permisos para realizar esta operación.'
        });
    }

    next();
}

function mismoUsuarioOAdmin(req, res, next) {
    const idSolicitado = Number(req.params.id);
    const idAutenticado = Number(req.usuario.id_usuario);

    if (
        req.usuario.rol !== 'administrador' &&
        idAutenticado !== idSolicitado
    ) {
        return res.status(403).json({
            mensaje: 'No tienes permiso para modificar este usuario.'
        });
    }

    next();
}

/**
 * Identifica al usuario si envía token, pero NO exige sesión.
 * Se usa en endpoints públicos que muestran más datos a un administrador.
 */
function autenticarOpcional(req, res, next) {
    if (!req.headers.authorization) {
        return next();
    }

    return autenticar(req, res, next);
}

module.exports = {
    autenticarOpcional,
    autenticar,
    soloAdministrador,
    mismoUsuarioOAdmin
};
