const stripe = require('../utils/stripe');
var mongoose = require("mongoose");
var { orderSchema,productSchema } = require("../models/product");
const Order = mongoose.model("Order", orderSchema);
const Product = mongoose.model("Product", productSchema);
// Create Checkout Session
exports.createCheckoutSession = async (req, res) => {
  try {
    const { 
      items, 
      customerInfo, 
      shippingInfo, 
      shippingCost, 
      taxAmount, 
      totalAmount, 
      successUrl, 
      cancelUrl,
      currency
    } = req.body;

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
          description: item.selectedSize ? `Size: ${item.selectedSize}` : '',
          images: item.image ? [item.image] : [],
          metadata: {
            productId: item.product,
            selectedSize: item.selectedSize || '',
            selectedColor: item.selectedColor || ''
          }
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item if applicable
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: currency,
          product_data: {
            name: 'Shipping',
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    // Add tax as a line item
    if (taxAmount > 0) {
      lineItems.push({
        price_data: {
          currency: currency,
          product_data: {
            name: 'Tax',
          },
          unit_amount: Math.round(taxAmount * 100),
        },
        quantity: 1,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerInfo.email,
      billing_address_collection: 'required',
      /*shipping_address_collection: {
        allowed_countries: ['AE'], // Adjust as needed
      },*/
      metadata: {
       // customerInfo: JSON.stringify(customerInfo),
       // shippingInfo: JSON.stringify(shippingInfo),
        originalItems: JSON.stringify(items)
      },
      // Optional: Pre-fill shipping address
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: Math.round(shippingCost * 100),
              currency: currency,
            },
            display_name: shippingCost === 0 ? 'Free shipping' : 'Standard shipping',
          },
        },
      ],
    });

    // Create order in database with pending status
    const order = new Order({
      items,
      totalAmount,
      customerInfo,
      shippingAddress: shippingInfo,
      paymentStatus: 'pending',
      sessionId: session.id,
      createdAt: new Date()
    });

    await order.save();

    res.status(200).json({
      sessionId: session.id,
      orderId: order._id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Handle successful payment return
exports.handlePaymentSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Missing session ID' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      // Update order status
      const order = await Order.findOneAndUpdate(
        { sessionId: session_id },
        { 
          paymentStatus: 'paid',
          paymentIntentId: session.payment_intent,
          paidAt: new Date(),
          stripeCustomerId: session.customer
        },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.status(200).json({
        message: 'Payment successful',
        orderId: order._id,
        order: order
      });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }

  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get checkout session details
exports.getCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const order = await Order.findOne({ sessionId });

    res.status(200).json({
      session,
      order
    });

  } catch (error) {
    console.error('Error fetching checkout session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Webhook handler for Stripe events
exports.handleWebhook = async (req, res) => {
    console.log(req.headers)
    console.log(req.body)
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
console.log(endpointSecret)
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Helper function to update inventory
  const updateInventory = async (order) => {
    if (!order || !order.items || !Array.isArray(order.items)) {
      console.log('No valid order items found');
      return;
    }

    for (const item of order.items) {
      if (!item.selectedSize || !item.quantity || !item.product) {
        console.log('Skipping item with missing required fields:', item);
        continue;
      }

      try {
        // Find the product
        const product = await Product.findById(item.product);
        if (!product) {
          console.log(`Product not found: ${item.product}`);
          continue;
        }

        // Check if product has sizes and quantities arrays
        if (!product.sizes || !product.quantities) {
          console.log(`Product ${item.productId} has invalid sizes/quantities structure`);
          continue;
        }

        // Find the index of the selected size
        const sizeIndex = product.sizes.findIndex(size => size === item.selectedSize);
        if (sizeIndex === -1) {
          console.log(`Size ${item.selectedSize} not found in product ${item.productId}`);
          continue;
        }

        // Check if there's enough quantity
        const currentQuantity = product.quantities[sizeIndex];
        if (currentQuantity < item.quantity) {
          console.log(`Insufficient quantity for product ${item.productId}, size ${item.selectedSize}. Available: ${currentQuantity}, Required: ${item.amount}`);
          continue;
        }

        // Update the quantity
        const newQuantity = currentQuantity - item.quantity;
        const updateQuery = {};
        updateQuery[`quantities.${sizeIndex}`] = newQuantity;
         // Also decrease the main product quantity
        updateQuery.$inc = { quantity: -item.quantity };
        await Product.findByIdAndUpdate(item.product, updateQuery);
        
        console.log(`Updated inventory for product ${item.product}, size ${item.selectedSize}: ${currentQuantity} -> ${newQuantity}`);
      } catch (error) {
        console.error(`Error updating inventory for item:`, item, error);
      }
    }
  };

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Update order status and get the updated order
      const updatedOrder = await Order.findOneAndUpdate(
        { sessionId: session.id },
        { 
          paymentStatus: 'paid',
          paymentIntentId: session.payment_intent,
          paidAt: new Date(),
          stripeCustomerId: session.customer,
          // Store actual shipping address from Stripe if different
          actualShippingAddress: session.shipping_details ? session.shipping_details.address : null
        },
        { new: true } // Return the updated document
      );

      // Update inventory
      if (updatedOrder) {
        await updateInventory(updatedOrder);
      }

      console.log('Checkout session completed:', session.id);
      break;

    case 'checkout.session.async_payment_succeeded':
      const asyncSession = event.data.object;
      
      const updatedAsyncOrder = await Order.findOneAndUpdate(
        { sessionId: asyncSession.id },
        { 
          paymentStatus: 'paid',
          paymentIntentId: asyncSession.payment_intent,
          paidAt: new Date()
        },
        { new: true }
      );

      // Update inventory
      if (updatedAsyncOrder) {
        await updateInventory(updatedAsyncOrder);
      }

      console.log('Async payment succeeded:', asyncSession.id);
      break;

    case 'checkout.session.async_payment_failed':
      const failedAsyncSession = event.data.object;
      
      await Order.findOneAndUpdate(
        { sessionId: failedAsyncSession.id },
        { paymentStatus: 'failed' }
      );

      console.log('Async payment failed:', failedAsyncSession.id);
      break;

    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Update order by payment intent ID (backup)
      const updatedPaymentOrder = await Order.findOneAndUpdate(
        { paymentIntentId: paymentIntent.id },
        { 
          paymentStatus: 'paid',
          paidAt: new Date()
        },
        { new: true }
      );

      // Update inventory
      if (updatedPaymentOrder) {
        await updateInventory(updatedPaymentOrder);
      }

      console.log('Payment intent succeeded:', paymentIntent.id);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      
      await Order.findOneAndUpdate(
        { paymentIntentId: failedPayment.id },
        { paymentStatus: 'failed' }
      );

      console.log('Payment intent failed:', failedPayment.id);
      break;

    case 'invoice.payment_succeeded':
      // Handle subscription payments if needed
      console.log('Invoice payment succeeded');
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Get order details
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('items.product', 'name price');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get orders by user
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { email } = req.query;

    let query = {};
    
    if (userId) {
      query.userId = userId;
    } else if (email) {
      query['customerInfo.email'] = email;
    } else {
      return res.status(400).json({ error: 'User ID or email required' });
    }

    const orders = await Order.find(query)
      .populate('items.product', 'name price')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cancel order (only if payment is pending)
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.paymentStatus !== 'pending') {
      return res.status(400).json({ error: 'Cannot cancel paid order' });
    }

    // If there's a session, expire it
    if (order.sessionId) {
      try {
        await stripe.checkout.sessions.expire(order.sessionId);
      } catch (stripeError) {
        console.log('Error expiring session:', stripeError.message);
      }
    }

    order.paymentStatus = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    res.status(200).json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Legacy function - keeping for backward compatibility
exports.createPaymentIntent = async (req, res) => {
  res.status(410).json({ 
    error: 'Payment Intent method is deprecated. Use createCheckoutSession instead.' 
  });
};

// Legacy function - keeping for backward compatibility
exports.confirmPayment = async (req, res) => {
  res.status(410).json({ 
    error: 'Confirm Payment method is deprecated. Use webhook handlers instead.' 
  });
};