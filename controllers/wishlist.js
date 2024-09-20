export const handleWishlist = async (req, res, knex) => {
    const { productSlug } = req.body;
    const { userId } = req.session;

    console.log(userId, productSlug);

    if (userId) {
        knex('wishlist')
            .insert({
                user_id: userId,
                product_slug: productSlug
            })
            .then(response => {
                console.log(response);
                res.send({ 'success': 'Product saved to wish list succesfully' });
            })
            .catch(err => console.log(err));
    } else {
        return res.status(401).json({ error: 'Unauthorized: No user logged in' });
    }
}

export const handleWishlistProducts = async (req, res, knex) => {
    const { slug } = req.body;

    try {
        // Ensure the user is logged in
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized: No user logged in' });
        }

        // Delete the product from the wishlist
        const result = await knex('wishlist')
            .where('product_slug', '=', slug)
            .andWhere('user_id', '=', req.session.userId)
            .delete();

        if (result === 0) {
            // No rows were affected, meaning the item was not found in the wishlist
            return res.status(404).json({ error: 'Product not found in wishlist' });
        }

        // If successful, send a success message
        return res.status(200).json({ status: 'OK', message: 'Product removed from wishlist' });
    } catch (error) {
        // Log and send the error message
        console.error('Error removing product from wishlist:', error);
        return res.status(500).json({ error: 'Failed to remove product from wishlist' });
    }
}