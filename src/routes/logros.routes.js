const express = require('express');
const controlador = require('../controllers/logros.controller');
const { autenticar, soloAdministrador } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', controlador.obtener);
router.put('/:id', autenticar, soloAdministrador, controlador.actualizar);
router.delete('/:id', autenticar, soloAdministrador, controlador.eliminar);

module.exports = router;
