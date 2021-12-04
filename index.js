require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');

const user = require('./src/routes/User');
const posts = require('./src/routes/Posts');
const jobs = require('./src/routes/Jobs');
const file = require('./src/routes/File');

const port = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);
mongoose.connect(process.env.DB_CONNECT, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

require('./src/routes/Messages.socket')(io);

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(cors({ origin: '*' }));

app.use(user, posts, jobs, file);

server.listen(port, () => console.log(`Listening on port ${port}`));
