const resenasService = require('../services/resenas.service');

async function listar(req, res) {
    res.status(200).json(await resenasService.listar(req.query));
}

async function listarPorVideojuego(req, res) {
    res.status(200).json(
        await resenasService.listarPorVideojuego(req.params.id, req.query)
    );
}

async function obtener(req, res) {
    res.status(200).json(await resenasService.obtener(req.params.id));
}

async function crear(req, res) {
    const resena = await resenasService.crear(req.usuario, req.body);

    res.status(201)
        .location(`/api/resenas/${resena.id_resena}`)
        .json({ mensaje: 'Reseña publicada correctamente.', resena });
}

async function actualizar(req, res) {
    const resena = await resenasService.actualizar(
        req.params.id,
        req.usuario,
        req.body
    );

    res.status(200).json({
        mensaje: 'Reseña actualizada correctamente.',
        resena
    });
}

async function eliminar(req, res) {
    res.status(200).json(
        await resenasService.eliminar(req.params.id, req.usuario)
    );
}

module.exports = {
    listar,
    listarPorVideojuego,
    obtener,
    crear,
    actualizar,
    eliminar
};
