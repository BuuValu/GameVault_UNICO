const { crearRepositorioCatalogo } = require('./catalogo.repository');

module.exports = crearRepositorioCatalogo({
    tabla: 'genres',
    pk: 'genre_id',
    usoTabla: 'video_game_genres',
    campoUso: 'total_videojuegos'
});
