import express from 'express';
import knex from 'knex';
import cors from 'cors';
import bcrypt from 'bcrypt';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { createReceipt } from './createReceipt.js'
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Stripe from 'stripe';
import { Storage } from '@google-cloud/storage'
// import { sign } from 'crypto';
import { sendOrderSummary } from './sendMail.js';
const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:4321',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
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
const stripe = new Stripe('sk_test_51PVVxaEZbF6dio7icCgvwPP0qU9FI4vlcqsvVJYQyqvU6Pn9AzC29gOVgPVXPgaW7OGak1RIpUBQNU6PVcaAmKOl00LwKjqpJp');

// app.get("/", (req, res) => {
//   let session = req.session.userId
//   session ? res.status(200).send("Hello my friend, you are logged in") : res.status(400).send("You need to log in")
//   console.log(req.sessionID);
// })

// app.get('/shop', (req, res) => {
//   if (req.session.userId) {
//     res.send(`You are logged in as ${req.session.userId}`)
//   } else {
//     res.send(`You aren't logged in`);

//   }
// });
app.post('/login', async (req, res) => {
  const { email, password, remember } = req.body;
  try {
    knex
      .select('*')
      .from('login')
      .where('email', '=', email)
      .then(response => {
        bcrypt.compare(password, response[0].hash).then(function (result) {
          return result;
        }).then(isValid => {
          if (isValid) {
            req.session.userId = response[0].id;
            req.session.userEmail = response[0].email;
            if (remember) {
              req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            } else {
              req.session.cookie.maxAge = 3600000;
            }
            return res.status(200).json({ message: 'Logged in!', redirect: '/shop' });
          }
          res.status(401).send('User or password could be wrong. Try again!');
        });
      });
  } catch (err) {
    console.log(err);
  }
});
app.post('/logout', (req, res) => {
  console.log('Session before destruction:', req.session);

  req.session.destroy(err => {
    if (err) {
      console.log(err);
      res.status(500).json({ 'err': 'Error logging out' });
    } else {
      console.log('Session after destruction:', req.session);
      res.json({ "loggedOut": "true" });
    }
  });
});
app.get('/check-session', (req, res) => {
  // Check if the user is logged in
  if (req.session && req.session.userEmail) {
    knex('users')
      .where('users.email', '=', req.session.userEmail)
      .leftJoin('orders', 'users.id', 'orders.user_id')
      .leftJoin('wishlist', 'users.id', 'wishlist.user_id')
      .leftJoin('receipts', 'orders.id', 'receipts.order_id')
      .select(
        'users.*',
        'orders.id as order_id',
        'orders.order_date',
        'orders.order_status',
        'wishlist.product_slug',
        'receipts.receipt_url'
      )
      .then(response => {
        if (response.length > 0) {
          // Extract user info
          const user = response[0];
          const userInfo = {
            id: user.id,
            name: user.name,
            email: user.email,
            birthdate: user.birthdate,
            phone: user.phone,
            county: user.county,
            city: user.city,
            address: user.address,
            orders: [],
            wishlist: []
          };

          const ordersMap = new Map();
          const wishlistSet = new Set();

          response.forEach(row => {
            if (row.order_id) {
              if (!ordersMap.has(row.order_id)) {
                ordersMap.set(row.order_id, {
                  order_id: row.order_id,
                  order_date: row.order_date,
                  order_status: row.order_status,
                  receipt_url: row.receipt_url
                });
              }
            }
            if (row.product_slug && !wishlistSet.has(row.product_slug)) {
              wishlistSet.add(row.product_slug);
              userInfo.wishlist.push(row.product_slug);
            }
          });
          userInfo.orders = Array.from(ordersMap.values());
          res.json({ "loggedIn": true, "status": 200, "userInfo": userInfo });
        } else {
          res.json({ "loggedIn": false, "status": 401 });
        }
      })
      .catch(err => {
        res.status(500).send('Something went wrong..');
      });
  } else {
    res.status(401).json({ "loggedIn": false, "status": 401 });
  }
});
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const salt = 10;
  const hash = bcrypt.hashSync(password, salt);
  const newUser = knex
    .transaction(trx => {
      knex('login')
        .transacting(trx)
        .insert({
          hash: hash,
          email: email
        }, "email")
        .then(res => {
          return trx
            .insert({
              name: name,
              email: res[0].email,
              // joined: new Date()
            }, '*')
            .into('users')
        })
        .then(trx.commit)
        .catch(trx.rollback)
    })
    .catch(err => {
      console.log('Error:' + err);
    });
  newUser.then(user => {
    res.send(user[0]);
  });
});
app.post('/wishlist', async (req, res) => {
  const { productSlug } = req.body;
  const { userId } = req.session;

  if (userId) {
    knex('wishlist')
      .insert({
        user_id: userId,
        product_slug: productSlug
      })
      .then(response => res.send('Product saved to wish list succesfully'))
      .catch(err => console.log);
  }
});

app.patch('/remove-wishlist-product', async (req, res) => {
  const {slug} = req.body;
  console.log(req.body);

  console.log(slug)
  await knex('wishlist')
  .delete('*')
  .where('product_slug', '=', slug).then(console.log);
  res.send({"message": "OK"});
})
const checkSession = async (req) => {
  console.log(req.session);
  if (req.session && req.session.userEmail) {
    try {
      const response = await knex.select('*')
        .from('users')
        .where('email', '=', req.session.userEmail);

      if (response.length > 0) {
        return { sessionStatus: true, profileData: response[0] };
      }
    } catch (err) {
      console.error(err);
      return { sessionStatus: false, profileData: 'Guest' };
    }
  }
  return { sessionStatus: false, profileData: 'Guest' };
};

/*
1). Vin datele comenzii din front end
2). Bag datele din front-end in baza de date
3). Generez factura
4). Salvez datele facturii in receipts
5). Trimite mail-ul cu link-ul de la factura 


*/
app.post('/generate-receipt', async (req, res) => {
  try {
    const receiptData = req.body;
    let { sessionStatus, profileData } = await checkSession(req);

    const insertOrderIntoDb = await knex('orders')
      .returning('id')
      .insert({
        receiver: `${receiptData.name} ${receiptData.surname}`,
        address: receiptData.address,
        total_amount: receiptData.total,
        order_status: 'Pending',
        mentions: receiptData.additionalInfo,
        delivery_method: receiptData.delivery_method,
        is_guest: sessionStatus,
        user_id: profileData.id
      });
    const orderId = insertOrderIntoDb[0].id;

    const receiptId = await knex('receipts')
    .returning('id')
    .insert({
      order_id: orderId
    });
    receiptData.receipt_nr = await generateReceiptNr(receiptId);

    const filename = `receipt-${receiptData.receipt_nr}.pdf`;
    const filePath = createReceipt(receiptData, filename);

    // receiptData.receipt_url = await uploadReceiptToCloud(filename, filePath);

    await sendOrderSummary(receiptData.email, receiptData, orderId, filename, filePath);

    // Sending the response after all operations are complete
    res.status(200).json({ 'message': 'Order placed successfully' })
    // res.status(200).json({ id: orderId, receipt_url: signedUrl });
  } catch (error) {
    console.error('Error generating or uploading receipt:', error);
    res.status(500).json({ error: 'Failed to generate or upload receipt' });
  }
});
const generateReceiptNr = async (receiptId) => {
  const date = new Date();
  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();
 
  return `${receiptId[0].id}${day}${month}${year}`;
}

const uploadReceiptToCloud = async (fileName, filePath) => {
  const storage = new Storage({
    keyFilename: './receipts/fashionculture-428107-064c8b954f93.json', 
    projectId: 'fashionculture', 
  });
  const bucketName = 'fashionculture_receipts';

  const destFileName = filename;
  await storage.bucket(bucketName).upload(filePath, {
    destination: destFileName,
  });

  // Delete the local file after uploading
  // fs.unlinkSync(filePath);

  const [signedUrl] = await storage.bucket(bucketName).file(destFileName).getSignedUrl({
    action: 'read',
    expires: '03-17-2025'
  });

  return signedUrl;
}


app.post('/create-checkout-session', async (req, res) => {
  const products = req.body.items.map(product => {
    return {
      price_data: {
        currency: 'usd',
        product_data: {
          name: product.title,
        },
        unit_amount: product.price * 100, // Amount in cents
      },
      quantity: product.quantity,
    };
  });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: products,
      mode: 'payment',
      success_url: `http://localhost:4321/checkout/shipping/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:4321/cart`
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.get('/check-payment-status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.json({ status: session.payment_status });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});
app.get('/orders', async (req, res) => {
  //  knex('orders')
  //   .insert({
  //     id: Math.round(Math.random() * 99999),
  //     user_id: 67,
  //     order_date: new Date(),
  //     total_amount: 300,
  //     status: 'Delivered',
  //     receipt: '#23423423',
  //     is_guest: true,
  //     delivery_method: 'Courier',
  //     receiver: 'Valentin Ciolofan',
  //     address: 'Str. wieowoi hello world',
  //     order_status: 'Pending',
  //     mentions: 'test nothing hereeee'
  //   }).then(console.log)

  knex('orders')
    .from('orders')
    .then(orders => {
      res.send(orders);
    });

})
app.get('/stats', async (req, res) => {
  try {
    const stats = await knex('users')
      .select(
        knex.raw('(SELECT COUNT(DISTINCT users.id) FROM users) AS total_users'),
        knex.raw('(SELECT COUNT(DISTINCT orders.receiver) FROM orders) AS total_customers'),
        knex.raw('COALESCE((SELECT SUM(orders.total_amount) FROM orders), 0) AS total_sales')
      )
      .first();

    res.status(200).json(stats);
    console.log(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
const updateOrderStatus = async (orderId, status) => {
  try {
    await knex('orders')
      .where({ id: orderId })
      .update({ order_status: status });
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};
app.put('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    await updateOrderStatus(orderId, status);
    res.status(200).send({ message: 'Order status updated successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Error updating order status', error });
  }

})
app.patch('/update-profile', async (req, res) => {
  const userEmail = req.session?.userEmail; // Assuming you have user email stored in session
  if (!userEmail) {
    console.error('Unauthorized: No userEmail in session');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const updates = req.body;
  try {
    const updateResult = await knex('users')
      .where({ email: userEmail })
      .update(updates);

    if (updateResult === 0) {
      console.error('No rows updated, possible invalid userEmail');
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
const port = 3000;
app.listen(port);



