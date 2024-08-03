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

    knex.select('*')
      .from('users')
      .where('email', '=', req.session.userEmail)
      .then(response => {
        res.json({ "loggedIn": true, "status": 200, "userInfo": response[0] });
      })
      .catch(err => {
        console.error(err);
        res.status(500).send('Something went wrong..');
      });
  } else {
    res.status(401).json({ "loggedIn": false, "status": 401 });
  }
});



app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
console.log(name, email, password);
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

app.get('/api/profile/:profileId', async (req, res) => {
  const profileData = await checkSession(req);
  
  res.send(profileData);
});
/*
i need the following api methods:
/ which will return the website
/login --> get method
/register which will be a post method
*/
const checkSession = async (req) => {
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
      return { sessionStatus: false, user_id: null };
    }
  }
  return { sessionStatus: false, user_id: null };
};


app.post('/generate-receipt', async (req, res) => {
  const receiptData = req.body;
  receiptData.receipt_nr = Math.floor(Math.random() * 123456789);
  console.log(receiptData)
  try {
    const filename = `receipt-${receiptData.receipt_nr}.pdf`;
    // const filePath = createReceipt(receiptData, filename);

    // Upload the PDF to Google Cloud Storage
    const destFileName = filename;
    // await storage.bucket(bucketName).upload(filePath, {
      // destination: destFileName,
    // });

    // Delete the local file after uploading
    // fs.unlinkSync(filePath);

    // const [signedUrl] = await storage.bucket(bucketName).file(destFileName).getSignedUrl({
      // action: 'read',
      // expires: '03-17-2025'
    // });
    // console.log(signedUrl);

    let {sessionStatus, profileData} = await checkSession(req, res);
    await knex('orders')
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
    }).then(response => {
      res.status(200).json({ id: response[0].id });
    });
    // await knex('receipts').insert({
    //   order_id: orderid,
    //   receipt_url: signedUrl
    // });

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
console.log(updates);
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
app.listen(port);







// ========== 
// PLAYGROUND
// ========== 

// const matchingStrings = (strings, queries) => {
// work in progress

// }

// const lonelyinteger = (a) => {
//   let array = a;
  
// }
// lonelyinteger([1, 2, 3, 4, 3, 2, 1]);











  // const timeConversion = (time) => {
  //   let h = time.slice(0, 2);
  //   let m = time.slice(3, 5);
  //   let s = time.slice(6, 8);
  //   const am_pm = time.slice(8, 10);
  //   console.log(h, m, s);

  //   const totalSeconds = (h * 60 * 60) + (m * 60) + s;
  //   console.log(totalSeconds);
  //   const convertedTime = (totalSeconds * 2) / 60 / 60;
  //   console.log(convertedTime);
  //   const militaryTime = `${h}:${m}:${s}${am_pm}`;
  //   return militaryTime;
  // }

  // timeConversion('10:25:30PM');

/*
24 de ore intr o zi
fiecare are 60 de minute
cele 60 de minute au 60 de secunde
cele 60 de secunde au 1000 milisecunde

basically, intr-o zi sunt 86400
in 12 ore sunt 43200

cate milisecunde sunt intr-o ora?

*/