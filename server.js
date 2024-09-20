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
import { handleCheckSession } from './controllers/checkSession.js';
import { handleGenerateReceipt } from './controllers/generateReceipt.js';
import { handleCreateCheckoutSession, handleCheckPaymentStatus } from './controllers/checkPayment.js';
import { handleStats } from './controllers/stats.js';
import { handleUpdateProfile } from './controllers/updateProfile.js';

// Initialize Knex with connection to PostgreSQL
const dbConnection = process.env.DATABASE_URL || {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '2002',  // Replace with your actual local password
    database: 'ecommercedb',
  },
};

const db = knex({
  client: 'pg',
  connection: dbConnection,
});

const app = express();
app.use(express.json());

// Allow your local frontend (localhost:4321) and other origins (like a future production URL)
const allowedOrigins = ['http://localhost:4321', 'https://your-frontend-domain.com'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from your local frontend and production frontend
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

// PostgreSQL session store setup using connect-pg-simple
const PgSession = connectPgSimple(session);

// Configure session management to store sessions in PostgreSQL
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL, // Use the PostgreSQL connection string for deployed environment
  }),
  secret: 'your_secret_key',  // Replace with your actual secret key
  resave: false,              // Don't resave session if it hasn't been modified
  saveUninitialized: false,   // Only save sessions that are initialized
  cookie: {
    maxAge: 3600000,          // 1 hour session expiration
    secure: process.env.NODE_ENV === 'production', // Ensure cookies are only sent over HTTPS in production
    httpOnly: true,           // Make cookie inaccessible to JavaScript
    sameSite: 'Lax',          // Prevent CSRF by only sending cookies on same-site requests
  }
}));

// Test route to check if the server is running
app.get('/', (req, res) => res.send('It is working now'));

// Define routes for your API
app.post('/contact', (req, res) => handleContact(req, res));
app.post('/login', (req, res) => handleLogin(req, res, db, bcrypt));
app.post('/logout', (req, res) => handleLogOut(req, res));
app.get('/check-session', (req, res) => handleCheckSession(req, res, db));
app.post('/register', (req, res) => handleRegister(req, res, db, bcrypt));
app.post('/wishlist', (req, res) => handleWishlist(req, res, db));
app.patch('/remove-wishlist-product', (req, res) => handleWishlistProducts(req, res, db));
app.post('/generate-receipt', (req, res) => handleGenerateReceipt(req, res, db));
app.post('/create-checkout-session', (req, res) => handleCreateCheckoutSession(req, res));
app.get('/check-payment-status/:sessionId', (req, res) => handleCheckPaymentStatus(req, res));
app.get('/orders', (req, res) => handleOrders(req, res, db));
app.get('/stats', (req, res) => handleStats(req, res));
app.put('/api/orders/:orderId/status', (req, res) => handleOrderStatus(req, res, db));
app.patch('/update-profile', (req, res) => handleUpdateProfile(req, res));

// Start server on the specified port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
