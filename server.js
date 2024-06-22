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
app.post('/generate-receipt', (req, res) => {
  const receiptData = req.body;
  // const receiptData = {
  //   shipping: {
  //     name: "John Doe",
  //     address: "1234 Main Street",
  //     city: "San Francisco",
  //     state: "CA",
  //     country: "US",
  //     postal_code: 94111
  //   },
  //   items: [
  //     {
  //       item: "TC 100",
  //       description: "Toner Cartridge",
  //       quantity: 2,
  //       amount: 6000
  //     },
  //     {
  //       item: "USB_EXT",
  //       description: "USB Cable Extender",
  //       quantity: 1,
  //       amount: 2000
  //     }
  //   ],
  //   subtotal: 8000,
  //   paid: 0,
  //   receipt_nr: 1234
  // };
  receiptData.receipt_nr = Math.floor(Math.random() * 123456789);
  try {
    const filePath = createReceipt(receiptData, `receipt-${receiptData.receipt_nr}.pdf`);;
    res.status(200).json({ filePath: filePath });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

app.listen(port);







