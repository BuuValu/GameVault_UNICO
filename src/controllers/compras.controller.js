const comprasService = require('../services/compras.service');

async function listar(req, res) {
    res.status(200).json(await comprasService.listar(req.query));
}

async function listarPorUsuario(req, res) {
    res.status(200).json(
        await comprasService.listarPorUsuario(req.params.id, req.query)
    );
}

async function obtener(req, res) {
    res.status(200).json(
        await comprasService.obtener(req.params.id, req.usuario)
    );
}

async function crear(req, res) {
    const compra = await comprasService.crear(req.usuario, req.body);

    res.status(201)
        .location(`/api/compras/${compra.id_compra}`)
        .json({
            mensaje: 'Compra registrada. Queda pendiente de confirmación.',
            compra
        });
}

async function cambiarEstado(req, res) {
    const compra = await comprasService.cambiarEstado(req.params.id, req.body);

    res.status(200).json({
        mensaje: `Compra marcada como ${compra.estado}.`,
        compra
    });
}

async function cancelar(req, res) {
    res.status(200).json(
        await comprasService.cancelar(req.params.id, req.usuario)
    );
}

module.exports = {
    listar,
    listarPorUsuario,
    obtener,
    crear,
    cambiarEstado,
    cancelar
};
