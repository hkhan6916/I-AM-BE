require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const user = require('./src/routes/User');
const posts = require('./src/routes/Posts');
const jobs = require('./src/routes/Jobs');
const file = require('./src/routes/File');
const chat = require('./src/routes/Chat');
const notifications = require('./src/routes/Notifications');

const port = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

mongoose.connect(process.env.DB_CONNECT, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});
// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//   },
// });

const pubClient = createClient({ host: 'localhost', port: 6380 });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
});

require('./src/routes/Messages.socket')(io);

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(cors({ origin: '*' }));

app.use(user, posts, jobs, file, chat, notifications);

server.listen(port, () => console.log(`Listening on port ${port}`));
