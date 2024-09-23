export const handleLogin = async (req, res, knex, bcrypt) => {
    const { email, password, remember } = req.body;
    try {
        knex
            .select('*')
            .from('login')
            .where('email', '=', email)
            .then(response => {
                if (!response.length) {
                    // No user found, respond with 401 Unauthorized
                    return res.sendStatus(401);
                }
                bcrypt.compare(password, response[0].hash).then(function (result) {
                    return result;
                }).then(isValid => {
                    if (isValid) {
                        // Set session data and adjust cookie expiry based on "remember me"
                        req.session.userId = response[0].id;
                        req.session.userEmail = response[0].email;
                        console.log("req login:", req.session);
                        console.log("req login:", req.sessionID);
                        if (remember !== undefined) {
                            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                        }
                        // Respond with success message and redirect info
                        return res.status(200).json({ message: 'Logged in!', redirect: '/shop'});
                    } else {
                        // Invalid password
                        return res.status(401).json({ message: 'Invalid credentials' });
                    }
                });
            })
            .catch(err => {
                // Handle any unexpected errors
                console.error("Error during login", err);
                return res.status(500).json({ message: 'Error during login' });
            });
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ message: 'Unexpected error' });
    }
};
