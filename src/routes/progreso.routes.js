const express = require('express');
const controlador = require('../controllers/progreso.controller');
const { autenticar, mismoUsuarioOAdmin } = require('../middleware/auth');

// Montado en /api/usuarios/:id/logros
const router = express.Router({ mergeParams: true });

router.use(autenticar, mismoUsuarioOAdmin);

router.get('/', controlador.listar);
router.get('/:idLogro', controlador.obtener);
router.put('/:idLogro', controlador.registrar);
router.delete('/:idLogro', controlador.reiniciar);

module.exports = router;
