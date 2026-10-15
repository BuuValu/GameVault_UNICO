const videojuegosService = require('../services/videojuegos.service');

async function listar(req, res) {
    res.status(200).json(
        await videojuegosService.listar(req.query, req.usuario)
    );
}

async function obtener(req, res) {
    res.status(200).json(
        await videojuegosService.obtener(req.params.id, req.usuario)
    );
}

async function crear(req, res) {
    const videojuego = await videojuegosService.crear(req.body);

    res.status(201)
        .location(`/api/videojuegos/${videojuego.id_videojuego}`)
        .json({ mensaje: 'Videojuego creado correctamente.', videojuego });
}

async function reemplazar(req, res) {
    const videojuego = await videojuegosService.reemplazar(
        req.params.id,
        req.body
    );

    res.status(200).json({
        mensaje: 'Videojuego actualizado correctamente.',
        videojuego
    });
}

async function actualizarParcial(req, res) {
    const videojuego = await videojuegosService.actualizarParcial(
        req.params.id,
        req.body
    );

    res.status(200).json({
        mensaje: 'Videojuego actualizado correctamente.',
        videojuego
    });
}

async function eliminar(req, res) {
    res.status(200).json(await videojuegosService.eliminar(req.params.id));
}

async function listarGeneros(req, res) {
    res.status(200).json(
        await videojuegosService.listarGeneros(req.params.id, req.usuario)
    );
}

async function agregarGenero(req, res) {
    const { creado, generos } = await videojuegosService.agregarGenero(
        req.params.id,
        req.params.idGenero
    );

    res.status(creado ? 201 : 200).json({
        mensaje: creado
            ? 'Género asociado al videojuego.'
            : 'El videojuego ya tenía ese género.',
        generos
    });
}

async function quitarGenero(req, res) {
    res.status(200).json(
        await videojuegosService.quitarGenero(
            req.params.id,
            req.params.idGenero
        )
    );
}

module.exports = {
    listar,
    obtener,
    crear,
    reemplazar,
    actualizarParcial,
    eliminar,
    listarGeneros,
    agregarGenero,
    quitarGenero
};
