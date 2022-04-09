require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const stickySession = require('sticky-session');
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
    credentials: true, // for sticky sessions to work so cookies can be sent
  },
});
// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//   },
// });

const pubClient = createClient({ host: 'rediss://:p14900137e958a7e79204a2529280607fecc8c8a0628a75ccedcba3b5ba2a512d@ec2-54-228-13-108.eu-west-1.compute.amazonaws.com:10480', port: 6379 });
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
