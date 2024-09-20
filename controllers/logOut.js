export const handleLogOut = async (req, res) => {
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
}