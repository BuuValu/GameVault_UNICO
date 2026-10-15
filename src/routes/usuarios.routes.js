const express = require('express');

const router = express.Router();

const controlador = require('../controllers/usuarios.controller');

const {
    autenticar,
    soloAdministrador,
    mismoUsuarioOAdmin
} = require('../middleware/auth');

router.post('/registro', controlador.registrar);
router.post('/login', controlador.login);

router.get(
    '/',
    autenticar,
    soloAdministrador,
    controlador.listar
);

router.get(
    '/:id',
    autenticar,
    mismoUsuarioOAdmin,
    controlador.obtener
);

router.put(
    '/:id',
    autenticar,
    mismoUsuarioOAdmin,
    controlador.actualizar
);

router.patch(
    '/:id/contrasena',
    autenticar,
    mismoUsuarioOAdmin,
    controlador.cambiarContrasena
);

router.delete(
    '/:id',
    autenticar,
    soloAdministrador,
    controlador.eliminar
);

module.exports = router;