require('dotenv').config(); // para usar variáveis do .env
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });
const { Pool } = require('pg');

const PORT = 3001;

// Configuração do Neon/Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Map para controlar usuários conectados
const connectedUsers = new Map();

io.on('connection', async socket => {
  console.log('Usuário conectado!', socket.id);

  // Enviar histórico de mensagens para o usuário que conectou
  try {
    const result = await pool.query('SELECT * FROM conversas ORDER BY data_envio ASC');
    socket.emit('chat_history', result.rows);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
  }

  // Definir username
  socket.on('set_username', username => {
    socket.data.username = username;
    connectedUsers.set(socket.id, username);

    // Enviar lista de usuários conectados para todos
    io.emit('connected_users', Array.from(connectedUsers.values()));
  });

  // Receber mensagem
  socket.on('message', async text => {
    const username = socket.data.username;
    const data_envio = new Date();

    // Salvar no banco
    try {
      const query = 'INSERT INTO conversas(usuario, mensagem, data_envio) VALUES($1, $2, $3)';
      await pool.query(query, [username, text, data_envio]);
    } catch (err) {
      console.error('Erro ao salvar mensagem:', err);
    }

    // Enviar para todos os clientes
    io.emit('receive_message', {
      text,
      authorId: socket.id,
      author: username,
      data_envio
    });
  });

  // Desconexão
  socket.on('disconnect', reason => {
    connectedUsers.delete(socket.id);
    io.emit('connected_users', Array.from(connectedUsers.values()));
    console.log('Usuário desconectado!', socket.id);
  });
});

// Middleware para aceitar JSON
app.use(express.json());

// Endpoint para testar envio de mensagem via HTTP
app.post('/test-message', async (req, res) => {
  const { username, text } = req.body;
  const data_envio = new Date();

  try {
    const query = 'INSERT INTO conversas(usuario, mensagem, data_envio) VALUES($1, $2, $3)';
    await pool.query(query, [username, text, data_envio]);

    // Emitir mensagem para todos os sockets conectados
    io.emit('receive_message', { text, author: username, data_envio });

    res.status(200).json({ success: true, message: 'Mensagem salva com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro ao salvar a mensagem' });
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}...`));
