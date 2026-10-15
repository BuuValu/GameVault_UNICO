const { crearRepositorioCatalogo } = require('./catalogo.repository');

module.exports = crearRepositorioCatalogo({
    tabla: 'tags',
    pk: 'tag_id',
    usoTabla: 'review_tags',
    campoUso: 'total_resenas'
});
