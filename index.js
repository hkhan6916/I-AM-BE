require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');

const user = require('./src/routes/User');

const port = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);
mongoose.connect(process.env.DB_CONNECT, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(cors({ origin: '*' }));

app.use(user);

server.listen(port, () => console.log(`Listening on port ${port}`));
