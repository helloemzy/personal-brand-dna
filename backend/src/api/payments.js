const express = require('express');
const Joi = require('joi');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query, withTransaction } = require('../config/database');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication except webhook
router.use('/webhook', express.raw({ type: 'application/json' }));
router.use(authenticate);

// Validation schemas
const createCheckoutSchema = Joi.object({
  priceId: Joi.string().required(),
  tier: Joi.string().valid('professional', 'executive', 'enterprise').required(),
  billingPeriod: Joi.string().valid('monthly', 'yearly').default('monthly'),
  successUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().required()
});

const updateSubscriptionSchema = Joi.object({
  priceId: Joi.string().required(),
  tier: Joi.string().valid('professional', 'executive', 'enterprise').required()
});

// Get available pricing plans
router.get('/plans', asyncHandler(async (req, res) => {
  // Define pricing plans - in production, these could come from Stripe
  const plans = {
    professional: {
      id: 'professional',
      name: 'Professional',
      description: 'Perfect for professionals building their personal brand',
      features: [
        'Unlimited content generation',
        'Advanced voice calibration',
        'Performance analytics',
        'Content calendar',
        'Email support',
        'Up to 3 voice profiles'
      ],
      pricing: {
        monthly: {
          amount: 4900, // $49.00 in cents
          currency: 'usd',
          interval: 'month',
          priceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID
        },
        yearly: {
          amount: 49000, // $490.00 in cents (2 months free)
          currency: 'usd',
          interval: 'year',
          priceId: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID
        }
      },
      limits: {
        content: 1000,
        voiceProfiles: 3
      }
    },
    executive: {
      id: 'executive',
      name: 'Executive',
      description: 'For senior leaders and thought leaders',
      features: [
        'Everything in Professional',
        'Speaking opportunity preparation',
        'Media-ready content',
        'Strategic brand evolution',
        'Priority support',
        'Advanced analytics',
        'Team collaboration (up to 5 users)'
      ],
      pricing: {
        monthly: {
          amount: 14900, // $149.00 in cents
          currency: 'usd',
          interval: 'month',
          priceId: process.env.STRIPE_EXECUTIVE_MONTHLY_PRICE_ID
        },
        yearly: {
          amount: 149000, // $1490.00 in cents (2 months free)
          currency: 'usd',
          interval: 'year',
          priceId: process.env.STRIPE_EXECUTIVE_YEARLY_PRICE_ID
        }
      },
      limits: {
        content: 5000,
        voiceProfiles: 10
      }
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for organizations',
      features: [
        'Everything in Executive',
        'Custom voice modeling',
        'Brand compliance monitoring',
        'Dedicated customer success',
        'API access',
        'Custom integrations',
        'Unlimited users'
      ],
      pricing: {
        custom: true,
        contactSales: true
      },
      limits: {
        content: -1, // unlimited
        voiceProfiles: -1 // unlimited
      }
    }
  };

  res.json({
    status: 'success',
    data: {
      plans,
      currentTier: req.user.subscription_tier || 'free'
    }
  });
}));

// Create Stripe checkout session
router.post('/checkout', asyncHandler(async (req, res) => {
  const { error, value } = createCheckoutSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { priceId, tier, billingPeriod, successUrl, cancelUrl } = value;

  try {
    // Get or create Stripe customer
    let customerId = req.user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: `${req.user.first_name} ${req.user.last_name}`,
        metadata: {
          userId: req.user.id,
          tier: tier
        }
      });
      
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      await query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user.id]
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: req.user.id,
        tier: tier,
        billingPeriod: billingPeriod
      },
      subscription_data: {
        metadata: {
          userId: req.user.id,
          tier: tier
        }
      }
    });

    logger.logBusinessEvent('checkout_session_created', req.user.id, {
      sessionId: session.id,
      tier,
      billingPeriod,
      amount: session.amount_total
    });

    res.json({
      status: 'success',
      data: {
        checkoutUrl: session.url,
        sessionId: session.id
      }
    });

  } catch (stripeError) {
    logger.error('Stripe checkout error:', stripeError);
    throw new AppError('Failed to create checkout session', 500);
  }
}));

// Get current subscription
router.get('/subscription', asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.stripe_customer_id) {
    return res.json({
      status: 'success',
      data: {
        subscription: null,
        tier: 'free',
        status: 'active'
      }
    });
  }

  try {
    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.json({
        status: 'success',
        data: {
          subscription: null,
          tier: user.subscription_tier || 'free',
          status: user.subscription_status || 'active'
        }
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;

    // Get upcoming invoice for billing info
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: user.stripe_customer_id
      });
    } catch (error) {
      // No upcoming invoice
    }

    res.json({
      status: 'success',
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          priceId: priceId,
          interval: subscription.items.data[0].price.recurring.interval,
          amount: subscription.items.data[0].price.unit_amount,
          currency: subscription.items.data[0].price.currency
        },
        tier: user.subscription_tier,
        status: user.subscription_status,
        upcomingInvoice: upcomingInvoice ? {
          amount: upcomingInvoice.amount_due,
          currency: upcomingInvoice.currency,
          periodStart: new Date(upcomingInvoice.period_start * 1000),
          periodEnd: new Date(upcomingInvoice.period_end * 1000)
        } : null
      }
    });

  } catch (stripeError) {
    logger.error('Stripe subscription retrieval error:', stripeError);
    throw new AppError('Failed to retrieve subscription information', 500);
  }
}));

// Update subscription (upgrade/downgrade)
router.put('/subscription', asyncHandler(async (req, res) => {
  const { error, value } = updateSubscriptionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const { priceId, tier } = value;

  if (!req.user.stripe_customer_id) {
    throw new AppError('No subscription found', 404);
  }

  try {
    // Get current active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: req.user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new AppError('No active subscription found', 404);
    }

    const subscription = subscriptions.data[0];

    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
      metadata: {
        userId: req.user.id,
        tier: tier
      }
    });

    // Update user tier in database
    await query(
      'UPDATE users SET subscription_tier = $1, updated_at = NOW() WHERE id = $2',
      [tier, req.user.id]
    );

    logger.logBusinessEvent('subscription_updated', req.user.id, {
      oldTier: req.user.subscription_tier,
      newTier: tier,
      subscriptionId: subscription.id
    });

    res.json({
      status: 'success',
      message: 'Subscription updated successfully',
      data: {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          priceId: priceId,
          tier: tier
        }
      }
    });

  } catch (stripeError) {
    logger.error('Stripe subscription update error:', stripeError);
    throw new AppError('Failed to update subscription', 500);
  }
}));

// Cancel subscription
router.post('/subscription/cancel', asyncHandler(async (req, res) => {
  if (!req.user.stripe_customer_id) {
    throw new AppError('No subscription found', 404);
  }

  try {
    // Get current active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: req.user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new AppError('No active subscription found', 404);
    }

    const subscription = subscriptions.data[0];

    // Cancel subscription at period end
    const canceledSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });

    logger.logBusinessEvent('subscription_cancelled', req.user.id, {
      subscriptionId: subscription.id,
      tier: req.user.subscription_tier,
      cancelAtPeriodEnd: true
    });

    res.json({
      status: 'success',
      message: 'Subscription will be cancelled at the end of the current billing period',
      data: {
        subscription: {
          id: canceledSubscription.id,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000)
        }
      }
    });

  } catch (stripeError) {
    logger.error('Stripe subscription cancellation error:', stripeError);
    throw new AppError('Failed to cancel subscription', 500);
  }
}));

// Reactivate cancelled subscription
router.post('/subscription/reactivate', asyncHandler(async (req, res) => {
  if (!req.user.stripe_customer_id) {
    throw new AppError('No subscription found', 404);
  }

  try {
    // Get current subscription (including cancelled)
    const subscriptions = await stripe.subscriptions.list({
      customer: req.user.stripe_customer_id,
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new AppError('No subscription found', 404);
    }

    const subscription = subscriptions.data[0];

    if (!subscription.cancel_at_period_end) {
      throw new AppError('Subscription is not scheduled for cancellation', 400);
    }

    // Reactivate subscription
    const reactivatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false
    });

    logger.logBusinessEvent('subscription_reactivated', req.user.id, {
      subscriptionId: subscription.id,
      tier: req.user.subscription_tier
    });

    res.json({
      status: 'success',
      message: 'Subscription reactivated successfully',
      data: {
        subscription: {
          id: reactivatedSubscription.id,
          cancelAtPeriodEnd: false,
          status: reactivatedSubscription.status
        }
      }
    });

  } catch (stripeError) {
    logger.error('Stripe subscription reactivation error:', stripeError);
    throw new AppError('Failed to reactivate subscription', 500);
  }
}));

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handling error:', error);
    res.status(500).send('Webhook handling failed');
  }
}));

// Webhook event handlers
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const tier = session.metadata.tier;

  await query(
    'UPDATE users SET subscription_tier = $1, subscription_status = $2, updated_at = NOW() WHERE id = $3',
    [tier, 'active', userId]
  );

  logger.logBusinessEvent('subscription_activated', userId, {
    tier,
    sessionId: session.id,
    customerId: session.customer
  });
}

async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const subscription = invoice.subscription;

  // Update subscription status to active
  const userResult = await query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    
    await query(
      'UPDATE users SET subscription_status = $1, updated_at = NOW() WHERE id = $2',
      ['active', userId]
    );

    logger.logBusinessEvent('payment_succeeded', userId, {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      subscriptionId: subscription
    });
  }
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  const userResult = await query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    
    // Don't immediately suspend - Stripe will retry
    logger.logBusinessEvent('payment_failed', userId, {
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      attemptCount: invoice.attempt_count
    });
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  
  const userResult = await query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    const status = subscription.status;
    
    await query(
      'UPDATE users SET subscription_status = $1, updated_at = NOW() WHERE id = $2',
      [status, userId]
    );

    logger.logBusinessEvent('subscription_status_updated', userId, {
      subscriptionId: subscription.id,
      status: status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  
  const userResult = await query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    
    await query(
      'UPDATE users SET subscription_tier = $1, subscription_status = $2, updated_at = NOW() WHERE id = $3',
      ['free', 'cancelled', userId]
    );

    logger.logBusinessEvent('subscription_deleted', userId, {
      subscriptionId: subscription.id
    });
  }
}

module.exports = router;