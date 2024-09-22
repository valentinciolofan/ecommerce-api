import express from "express";
import session from "express-session";
import knex from "knex"; 
import pgSession from "connect-pg-simple";
import pg from 'pg'
import bcrypt from 'bcryptjs';
import cors from 'cors';

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

const app = express();
app.use(express.json());

// app.use(cors({
//   origin: 'https://ecommerce-ten-rose-33.vercel.app', // allow any domains for testing
//   credentials: true, // Allow credentials (like cookies)
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
//   allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
// }));


app.use(cors({
  origin: `https://ecommerce-ten-rose-33.vercel.app`,
  credentials: true, 
  // optionSuccessStatus: 200,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
}));



const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessary for hosted environments like Heroku
  },
  // host: 'localhost',     // Localhost for local development
  // user: 'postgres',      // Your PostgreSQL user
  // password: '2002',      // Your PostgreSQL password
  // database: 'ecommercedb',// The database you want to connect to
  // port: 5432 
});
// Configure session management using ConnectPgSimple
const PgSession = pgSession(session); 
app.use(
  session({
    store: new PgSession({
      pool: pgPool,                // Your Knex connection pool
      tableName: 'session'        // Table name for storing sessions
    }),
    secret: "your_secret_key", // Replace with your secret key
    resave: false, // Don't resave session if it hasn't been modified
    saveUninitialized: false, // Only save sessions that are initialized
    cookie: {
      maxAge: 3600000, // 1 hour session expiration
      secure: true, // Ensure cookies are only sent over HTTPS in production
      httpOnly: true, // Make cookie inaccessible to JavaScript
      sameSite: 'none', // Prevent CSRF by only sending cookies on same-site requests
    },
  })
);
// app.options('*', cors()); // Preflight requests for all routes
// app.set("trust proxy", 1); // add this line to ensure proxy headers are trusted

// Test route to check if the server is running
app.get('/', async (req, res) => {
  const orders = await knex('orders');
  console.log(orders);
  if (orders.length) {
    res.send(orders);
  }
});
app.post('/cookietest', (req, res) => {
  res.cookie('sessionId', 'someSessionIdValue', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 3600000,
});

res.send(req.session.cookie);


})
// Define routes for your API (other routes remain unchanged)
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
app.get('/orders', (req, res) => handleOrders(req, res, knex));
app.get('/stats', (req, res) => handleStats(req, res));
app.put('/api/orders/:orderId/status', (req, res) => handleOrderStatus(req, res, knex));
app.patch('/update-profile', (req, res) => handleUpdateProfile(req, res));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

