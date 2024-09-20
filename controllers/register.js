export const handleRegister = async (req, res, knex, bcrypt) => {
    const {
        name,
        email,
        password,
        confirm_password,
        city,
        county,
        address,
        birthday,
        phone
    } = req.body;
    console.log(name,
        email,
        password,
        confirm_password,
        city,
        county,
        address,
        birthday,
        phone);

    if (!name.length >= 3 || !email.length >= 5 || !password.length >= 8 || !city.length >= 3 || !address.length || !phone.length >= 10) {
        res.sendStatus(422, 'Unprocessable Entity');
    }
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
                            city: city,
                            county: county,
                            address: address,
                            birthdate: (birthday || null),
                            phone: phone
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
        console.log(user);
        if (user !== undefined) {
            res.sendStatus(200, 'OK');
        } else {
            res.sendStatus(409);
        }

    });
}

