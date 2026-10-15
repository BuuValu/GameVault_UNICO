const express = require('express');
const controlador = require('../controllers/resenas.controller');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

router.get('/', controlador.listar);
router.get('/:id', controlador.obtener);
router.post('/', autenticar, controlador.crear);
router.put('/:id', autenticar, controlador.actualizar);
router.delete('/:id', autenticar, controlador.eliminar);

module.exports = router;
