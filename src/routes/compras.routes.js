const express = require('express');
const controlador = require('../controllers/compras.controller');
const {
    autenticar,
    soloAdministrador,
    mismoUsuarioOAdmin
} = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticar, soloAdministrador, controlador.listar);
router.post('/', autenticar, controlador.crear);
router.get('/:id', autenticar, controlador.obtener);
router.patch(
    '/:id/estado',
    autenticar,
    soloAdministrador,
    controlador.cambiarEstado
);
router.delete('/:id', autenticar, controlador.cancelar);

// Montado en /api/usuarios/:id/compras
const porUsuario = express.Router({ mergeParams: true });

porUsuario.get(
    '/',
    autenticar,
    mismoUsuarioOAdmin,
    controlador.listarPorUsuario
);

module.exports = { router, porUsuario };
