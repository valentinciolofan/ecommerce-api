import express from 'express';
import knex from 'knex';
const app = express();
const port = 3000;

app.use(express.json());

 


const users = await knex.select('*').from('users');

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = database.find((user) => user.name === username && user.pass === password);
  console.log(user);

  if (user) {
      res.send("Logged In");
    } else {
      res.send("Try again");
    }
  })


app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

   const newUser = await knex('users').insert({
    name: name, 
    email: email, 
   }).then(console.log);

  res.send('It worked ' + newUser);
});
  

/*
i need the following api methods:
/ which will return the website
/login --> get method
/register which will be a post method



*/



app.listen(port);