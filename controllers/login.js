export const handleLogin = async (req, res, knex, bcrypt) => {
    const { email, password, remember } = req.body;
    try {
        knex
            .select('*')
            .from('login')
            .where('email', '=', email)
            .then(response => {
                if (!response.length) {
                    res.sendStatus(401);
                }
                bcrypt.compare(password, response[0].hash).then(function (result) {
                    return result;
                }).then(isValid => {
                    if (isValid) {
                        req.session.userId = response[0].id;
                        req.session.userEmail = response[0].email;
                        if (remember !== undefined) {
                            console.log(req.session);
                            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
                        }
                        return res.status(200).json({ message: 'Logged in!', redirect: '/shop' });
                    }
                });
            });
    } catch (err) {
        res.status(401);
    }
}