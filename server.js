import express from 'express';
import knex from 'knex';
import cors from 'cors';
import bcrypt from 'bcrypt';
const app = express();
const port = 3000;

app.use(express.json());


app.use(cors({
  origin: 'http://localhost:4321'
}));






app.post('/login', async (req, res) => {
  const { email } = req.body;
  console.log(req.body);

  bcrypt.compare(x, '$2b$10$1AmGO19ntNKbINVrwYxRwuDr0wGjUxQX99OcM2WXVW6mb0U.THini').then(function (result) {
    console.log(result);
  });


  try {
    const users = await knex.select('*').from('users');
    const user = users.find(user => user.email === email.toLowerCase());

    console.log(users);
    console.log(user)
    if (user) {
      res.send("Logged In");
    } else {
      res.send("Try again");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
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



app.listen(port);
