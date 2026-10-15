const generosRepository = require('../repositories/generos.repository');
const { crearServicioCatalogo } = require('./catalogo.service');

module.exports = crearServicioCatalogo({
    repositorio: generosRepository,
    maxNombre: 60,
    textos: {
        pk: 'id_genero',
        campoUso: 'total_videojuegos',
        noEncontrado: 'Género no encontrado.',
        duplicado: 'Ya existe un género con ese nombre.',
        enUso: 'No se puede eliminar el género porque hay videojuegos asociados. Quítalo primero de esos videojuegos.',
        eliminado: 'Género eliminado correctamente.'
    }
});
