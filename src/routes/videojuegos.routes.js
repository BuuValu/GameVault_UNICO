const express = require('express');
const controlador = require('../controllers/videojuegos.controller');
const resenasController = require('../controllers/resenas.controller');
const logrosController = require('../controllers/logros.controller');
const {
    autenticar,
    autenticarOpcional,
    soloAdministrador
} = require('../middleware/auth');

const router = express.Router();

// Catálogo público (el admin, si manda token, también ve los inactivos).
router.get('/', autenticarOpcional, controlador.listar);
router.get('/:id', autenticarOpcional, controlador.obtener);

router.post('/', autenticar, soloAdministrador, controlador.crear);
router.put('/:id', autenticar, soloAdministrador, controlador.reemplazar);
router.patch('/:id', autenticar, soloAdministrador, controlador.actualizarParcial);
router.delete('/:id', autenticar, soloAdministrador, controlador.eliminar);

// Géneros del videojuego (relación N:M)
router.get('/:id/generos', autenticarOpcional, controlador.listarGeneros);
router.put(
    '/:id/generos/:idGenero',
    autenticar,
    soloAdministrador,
    controlador.agregarGenero
);
router.delete(
    '/:id/generos/:idGenero',
    autenticar,
    soloAdministrador,
    controlador.quitarGenero
);

// Colecciones hijas: reseñas y logros pertenecen a un videojuego
router.get('/:id/resenas', resenasController.listarPorVideojuego);
router.get('/:id/logros', logrosController.listarPorVideojuego);
router.post(
    '/:id/logros',
    autenticar,
    soloAdministrador,
    logrosController.crear
);

module.exports = router;
