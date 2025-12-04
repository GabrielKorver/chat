const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // coloque a URL do Neon no .env
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;
