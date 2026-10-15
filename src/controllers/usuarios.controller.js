const jwt = require('jsonwebtoken');
const usuariosService = require('../services/usuarios.service');


async function registrar(req, res) {
    const usuario = await usuariosService.registrar(req.body);

    res.status(201)
        .location(`/api/usuarios/${usuario.id_usuario}`)
        .json({
            mensaje: 'Usuario registrado correctamente.',
            usuario
        });
}

async function login(req, res) {
    const usuario = await usuariosService.login(req.body);

    const token = jwt.sign(
        {
            id_usuario: usuario.id_usuario,
            rol: usuario.rol
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.status(200).json({
        mensaje: 'Inicio de sesión exitoso.',
        token,
        usuario
    });
}

async function listar(req, res) {
    res.status(200).json(await usuariosService.listar());
}

async function obtener(req, res) {
    res.status(200).json(await usuariosService.obtener(req.params.id));
}

async function actualizar(req, res) {
    const usuario = await usuariosService.actualizar(req.params.id, req.body);

    res.status(200).json({
        mensaje: 'Usuario actualizado correctamente.',
        usuario
    });
}

async function cambiarContrasena(req, res) {
    const usuario = await usuariosService.cambiarContrasena(
        req.params.id,
        req.body
    );

    res.status(200).json({
        mensaje: 'Contraseña actualizada correctamente.',
        usuario
    });
}

async function eliminar(req, res) {
    res.status(200).json(await usuariosService.eliminar(req.params.id));
}

module.exports = {
    registrar,
    login,
    listar,
    obtener,
    actualizar,
    cambiarContrasena,
    eliminar
};