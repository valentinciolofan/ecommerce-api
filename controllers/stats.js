export const handleStats = async (req, res) => {
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
}