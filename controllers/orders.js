export const handleOrders = async (req, res, knex) => {
    knex('orders')
        .from('orders')
        .then(orders => {
            res.send(orders);
        });

}
const updateOrderStatus = async (orderId, status, knex) => {
    try {
        await knex('orders')
            .where({ id: orderId })
            .update({ order_status: status });
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
};
export const handleOrderStatus = async (req, res, knex) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
        await updateOrderStatus(orderId, status, knex);
        res.status(200).send({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).send({ message: 'Error updating order status', error });
    }

}