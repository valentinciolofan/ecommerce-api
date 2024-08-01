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
import { sign } from 'crypto';
const app = express();
const port = 3000;
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:4321',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(session({
  secret: 'your_secret_key', // A secret key for session encoding
  resave: false,              // Forces the session to be saved back to the session store
  saveUninitialized: true,    // Forces a session that is "uninitialized" to be saved to the store
  cookie: { 
    maxAge: 3600000, 
    secure: process.env.NODE_ENV === 'production' ,
    httpOnly: true,
    sameSite: 'Lax'
  }   
}));

const storage = new Storage({
  keyFilename: './receipts/fashionculture-428107-064c8b954f93.json', // Path to your service account key file
  projectId: 'fashionculture', // Your Google Cloud project ID
});
const bucketName = 'fashionculture_receipts';

app.get("/", (req, res) => {
  let session = req.session.userId
  session ? res.status(200).send("Hello my friend, you are logged in") : res.status(400).send("You need to log in")
  console.log(req.sessionID);
})

app.get('/shop', (req, res) => {
  if (req.session.userId) {
    res.send(`You are logged in as ${req.session.userId}`)
  } else {
    res.send(`You aren't logged in`);

  }
});

app.get('/test-session', (req, res) => {
  if (req.session.views) {
    req.session.views++;
  } else {
    req.session.views = 1;
  }
  res.status(200).send(`Views: ${req.session.views}`);
});

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
      res.status(500).json({'err': 'Error logging out'});
    } else {
      console.log('Session after destruction:', req.session);
      res.json({"loggedOut": "true"});
    }
  });
});

app.get('/check-session', (req, res) => {
  // Check if the user is logged in
  if (req.session && req.session.userEmail) {

    knex.select('*')
      .from('users')
      .where('email', '=', req.session.userEmail)
      .then(response => {
        res.json({"loggedIn": true, "status": 200,"userInfo": response[0] });
      })
      .catch(err => {
        console.error(err);
        res.status(500).send('Something went wrong..');
      });
  } else {
    res.status(401).json({"loggedIn": false, "status": 401});
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


/*
i need the following api methods:
/ which will return the website
/login --> get method
/register which will be a post method
*/
app.post('/generate-receipt', async (req, res) => {
  const receiptData = req.body;
  console.log(receiptData);
  receiptData.receipt_nr = Math.floor(Math.random() * 123456789);
  receiptData.address = 'Str. Martir Marius Ciopec nr.18';
  receiptData.city = 'Timisoara, Timis';
  receiptData.name = 'Ciolofan Valentin-Catalin';
  receiptData.phone = '0759238389';
  receiptData.items[1].title = 'MAN BLUE BLOUSE FIT';
  try {
    const filename = `receipt-${receiptData.receipt_nr}.pdf`;
    const filePath = createReceipt(receiptData, filename);

    // Upload the PDF to Google Cloud Storage
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

    console.log(signedUrl);
    const orderid = 1234;
    await knex('receipts').insert({
      order_id: orderid,
      receipt_url: signedUrl
    });

    res.status(200).json({ message: 'Receipt generated and uploaded to Google Cloud Storage', filePath: `gs://${bucketName}/${destFileName}` });
  } catch (error) {
    console.error('Error generating or uploading receipt:', error);
    res.status(500).json({ error: 'Failed to generate or upload receipt' });
  }
});

const stripe = new Stripe('sk_test_51PVVxaEZbF6dio7icCgvwPP0qU9FI4vlcqsvVJYQyqvU6Pn9AzC29gOVgPVXPgaW7OGak1RIpUBQNU6PVcaAmKOl00LwKjqpJp');

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

// orders management


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
    console.log(orders);
    res.send(orders);
  });

})


app.get('/stats', async (req, res) => {
  knex.select(
    knex.raw('COUNT(DISTINCT users.id) AS total_users'),
    knex.raw('COUNT(DISTINCT orders.receiver) AS total_customers'),
    knex.raw('SUM(orders.total_amount) AS total_sales')
  )
  .from('users')
  .leftJoin('orders', function() {
    this.on('users.id', '=', 'orders.user_id');
  })
  .then(stats => res.send(stats[0]));
}) 

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

app.listen(port);







