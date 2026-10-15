require('dotenv').config();

const app = require('./src/app');
const pool = require('./src/config/db');

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    if (!process.env.JWT_SECRET) {
        console.error('Falta configurar JWT_SECRET en el archivo .env');
        process.exit(1);
    }

    try {
        const conexion = await pool.getConnection();

        await conexion.query('SELECT 1');
        conexion.release();

        console.log('Conexión con MySQL establecida.');

        app.listen(PORT, () => {
            console.log(`GameVault API: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('No se pudo conectar con MySQL:', error.message);
        process.exit(1);
    }
}

iniciarServidor();