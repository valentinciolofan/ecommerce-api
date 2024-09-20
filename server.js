import express from 'express';
import knex from 'knex';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { handleLogin } from './controllers/login.js';
import { handleLogOut } from './controllers/logOut.js';
import { handleContact } from './controllers/contact.js';
import { handleWishlist, handleWishlistProducts } from './controllers/wishlist.js';
import { handleRegister } from './controllers/register.js';
import { handleCheckSession } from './controllers/checkSession.js'
import { handleGenerateReceipt } from './controllers/generateReceipt.js';
import { handleCreateCheckoutSession, handleCheckPaymentStatus } from './controllers/checkPayment.js';
import { handleStats } from './controllers/stats.js';
import { handleUpdateProfile } from './controllers/updateProfile.js';

const app = express();
app.use(express.json());

// Allow your local frontend (localhost:4321) and other origins (like a future production URL)
const allowedOrigins = ['http://localhost:4321'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from your local frontend
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow credentials (like cookies)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
}));

app.use(session({
  secret: 'your_secret_key', // A secret key for session encoding
  resave: false,              // Forces the session to be saved back to the session store
  saveUninitialized: true,    // Forces a session that is "uninitialized" to be saved to the store
  cookie: {
    maxAge: 3600000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'Lax'
  }
}));

app.get('/', (req, res) => res.send('It is working now'))
app.post('/contact', (req, res) => handleContact(req, res));
app.post('/login', (req, res) => handleLogin(req, res, knex, bcrypt));
app.post('/logout', (req, res) => handleLogOut(req, res));
app.get('/check-session', (req, res) => handleCheckSession(req, res, knex));
app.post('/register', (req, res) => handleRegister(req, res, knex, bcrypt));
app.post('/wishlist', (req, res) => handleWishlist(req, res, knex));
app.patch('/remove-wishlist-product', (req, res) => handleWishlistProducts(req, res, knex));
app.post('/generate-receipt', (req, res) => handleGenerateReceipt(req, res, knex));
app.post('/create-checkout-session', (req, res) => handleCreateCheckoutSession(req, res));
app.get('/check-payment-status/:sessionId', (req, res) => handleCheckPaymentStatus(req, res));
app.get('/orders', (req, res) => handleOrders(req, res, knex))
app.get('/stats', (req, res) => handleStats(req, res));
app.put('/api/orders/:orderId/status', (req, res) => handleOrderStatus(req, res, knex))
app.patch('/update-profile', (req, res) => handleUpdateProfile(req, res));



const port = process.env.PORT || 3000;
app.listen(port);



