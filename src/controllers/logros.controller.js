const logrosService = require('../services/logros.service');

async function listarPorVideojuego(req, res) {
    res.status(200).json(
        await logrosService.listarPorVideojuego(req.params.id)
    );
}

async function obtener(req, res) {
    res.status(200).json(await logrosService.obtener(req.params.id));
}

async function crear(req, res) {
    const logro = await logrosService.crear(req.params.id, req.body);

    res.status(201)
        .location(`/api/logros/${logro.id_logro}`)
        .json({ mensaje: 'Logro creado correctamente.', logro });
}

async function actualizar(req, res) {
    const logro = await logrosService.actualizar(req.params.id, req.body);

    res.status(200).json({
        mensaje: 'Logro actualizado correctamente.',
        logro
    });
}

async function eliminar(req, res) {
    res.status(200).json(await logrosService.eliminar(req.params.id));
}

module.exports = {
    listarPorVideojuego,
    obtener,
    crear,
    actualizar,
    eliminar
};
