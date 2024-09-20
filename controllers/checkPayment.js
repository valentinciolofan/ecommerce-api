import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_PAYMENT_TOKEN);

export const handleCreateCheckoutSession = async (req, res) => {
    const products = req.body.items.map(product => {
        return {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: product.title,
                },
                unit_amount: product.price * 100, // Amount in cents
            },
            quantity: product.quantity,
        };
    });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: products,
            mode: 'payment',
            success_url: `http://localhost:4321/checkout/shipping/?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:4321/cart`
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
}

export const handleCheckPaymentStatus = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        res.json({ status: session.payment_status });
    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
}