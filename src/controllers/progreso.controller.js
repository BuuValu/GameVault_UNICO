const progresoService = require('../services/progreso.service');

async function listar(req, res) {
    res.status(200).json(
        await progresoService.listar(req.params.id, req.query)
    );
}

async function obtener(req, res) {
    res.status(200).json(
        await progresoService.obtener(req.params.id, req.params.idLogro)
    );
}

async function registrar(req, res) {
    const { creado, progreso } = await progresoService.registrar(
        req.params.id,
        req.params.idLogro,
        req.body
    );

    res.status(creado ? 201 : 200).json({
        mensaje: progreso.desbloqueado
            ? 'Progreso guardado. ¡Logro desbloqueado!'
            : 'Progreso guardado correctamente.',
        progreso
    });
}

async function reiniciar(req, res) {
    res.status(200).json(
        await progresoService.reiniciar(req.params.id, req.params.idLogro)
    );
}

module.exports = { listar, obtener, registrar, reiniciar };
