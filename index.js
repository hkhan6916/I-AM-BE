require('dotenv').config();
const express = require('express');
const http = require('http');
const cluster = require('cluster');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const numCPUs = require('os').cpus().length;
const { createAdapter } = require('@socket.io/redis-adapter');
// const { setupMaster, setupWorker } = require('@socket.io/sticky');
const { createAdapter: createClusterAdapter } = require('@socket.io/cluster-adapter');
const fileUpload = require('express-fileupload');
const user = require('./src/routes/User');
const posts = require('./src/routes/Posts');
const jobs = require('./src/routes/Jobs');
const file = require('./src/routes/File');
const chat = require('./src/routes/Chat');
const notifications = require('./src/routes/Notifications');
const messagesIo = require('./src/routes/Messages.socket');

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  const port = process.env.PORT || 5000;
  const httpServer = http.createServer();

  // setup sticky sessions
  // setupMaster(httpServer, {
  //   loadBalancingMethod: 'least-connection',
  // });

  // setup connections between the workers
  // setupPrimary();

  // needed for packets containing buffers (you can ignore it if you only send plaintext objects)
  // Node.js < 16.0.0
  // cluster.setupMaster({
  //   serialization: 'advanced',
  // });
  // Node.js > 16.0.0
  cluster.setupPrimary({
    serialization: 'advanced',
  });

  for (let i = 0; i < numCPUs; i += 1) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });

  cluster.on('fork', (worker) => {
    console.log('worker is dead:', worker.isDead());
  });
  // httpServer.listen(port, () => console.log(`Listening on port ${port}`));// TODO investigate where to listen, worker or master, Socketio docs suggest master
} else {
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
  // use the cluster adapter
  io.adapter(createClusterAdapter());

  messagesIo(io, process.pid);
  const redisUrl = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

  const redisPasswordConfig = process.env.REDIS_KEY ? { password: process.env.REDIS_KEY } : {};
  const pubClient = createClient({ url: redisUrl, ...redisPasswordConfig });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  });

  app.use(express.urlencoded({ extended: true }));
  app.use(fileUpload({
    abortOnLimit: true,
    limits: { fileSize: 50 * 1024 * 1024 },

  }));

  app.use(express.json());

  app.use(cors({ origin: '*' }));

  app.use(user, posts, jobs, file, chat, notifications);
  server.listen(port, () => console.log(`Listening on port ${port}`));
}

// server.listen(port, () => console.log(`Listening on port ${port}`));
