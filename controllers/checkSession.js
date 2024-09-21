export const handleCheckSession = (req, res, knex) => {
    console.log(req.session);
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
                                // Add order to map if it's not already added
                                ordersMap.set(row.order_id, {
                                    order_id: row.order_id,
                                    order_date: row.order_date,
                                    order_status: row.order_status,
                                    receipt_url: row.receipt_url
                                });
                            } else {
                                // Update receipt_url if the existing one is null and the new one is not null
                                const existingOrder = ordersMap.get(row.order_id);
                                if (!existingOrder.receipt_url && row.receipt_url) {
                                    existingOrder.receipt_url = row.receipt_url;
                                }
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
                    
                    res.json({ "loggedIn": false, "status": 401, "response": `${response}` });
                }
            })
            .catch(err => {
                res.status(500).send('Something went wrong..');
            });
    } else {
        res.status(401).json({ "loggedIn": false, "status": 401 });
    }
}