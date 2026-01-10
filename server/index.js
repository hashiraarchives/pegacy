/**
 * PEGACY Backend Server
 * Express + Stripe + PostgreSQL
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const db = require('./db');

// ----------------------------------------
// EMAIL CONFIGURATION
// ----------------------------------------
const NOTIFICATION_EMAIL = 'pegacysg@gmail.com';

// Create email transporter (configure in production with real SMTP)
let emailTransporter = null;

function initEmailTransporter() {
    // Check if email credentials are configured
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        emailTransporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('✓ Email transporter configured');
    } else {
        console.log('⚠ Email not configured - set EMAIL_HOST, EMAIL_USER, EMAIL_PASS');
    }
}

// Send order notification email
async function sendOrderNotification(orderData, images) {
    if (!emailTransporter) {
        console.log('⚠ Email not sent - transporter not configured');
        return false;
    }

    const {
        orderId,
        email: customerEmail,
        petName,
        quantity,
        shippingLocation,
        subtotal,
        discount,
        promoCode,
        promoDiscount,
        shipping,
        amount
    } = orderData;

    // Build email HTML
    const emailHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #C5A059 0%, #E6A15C 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">New Pegacy Order!</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Order ${orderId}</p>
            </div>

            <div style="background: #FDFCF8; padding: 30px; border: 1px solid #F5E6D3; border-top: none; border-radius: 0 0 16px 16px;">
                <h2 style="color: #4A3728; margin-top: 0;">Order Details</h2>

                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #666;">Pet Name:</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #4A3728; font-weight: bold;">${petName || 'Not specified'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #666;">Customer Email:</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #4A3728; font-weight: bold;">${customerEmail}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #666;">Quantity:</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #4A3728; font-weight: bold;">${quantity} figurine(s)</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #666;">Shipping:</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #4A3728; font-weight: bold;">${shippingLocation === 'singapore' ? 'Singapore (~1 week)' : 'Worldwide (~2 weeks)'}</td>
                    </tr>
                    ${promoCode ? `
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #666;">Promo Code:</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F5E6D3; color: #16a34a; font-weight: bold;">${promoCode} (-$${promoDiscount})</td>
                    </tr>
                    ` : ''}
                </table>

                <div style="background: #F5E6D3; padding: 20px; border-radius: 12px; margin-top: 20px;">
                    <h3 style="color: #4A3728; margin: 0 0 15px;">Payment Summary</h3>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Subtotal:</span>
                        <span style="color: #4A3728;">$${subtotal}</span>
                    </div>
                    ${discount > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #16a34a;">Discount:</span>
                        <span style="color: #16a34a;">-$${discount}</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Shipping:</span>
                        <span style="color: #4A3728;">$${shipping}</span>
                    </div>
                    <div style="border-top: 2px solid #C5A059; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between;">
                        <span style="color: #4A3728; font-weight: bold; font-size: 18px;">Total Paid:</span>
                        <span style="color: #C5A059; font-weight: bold; font-size: 18px;">$${amount} SGD</span>
                    </div>
                </div>

                <div style="margin-top: 25px; padding: 15px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 4px solid #16a34a;">
                    <p style="margin: 0; color: #16a34a; font-weight: bold;">✓ Payment Successful</p>
                    <p style="margin: 5px 0 0; color: #666; font-size: 14px;">${images ? images.length : 0} photos uploaded and ready for modelling</p>
                </div>

                <p style="color: #888; font-size: 12px; margin-top: 25px; text-align: center;">
                    This is an automated notification from Pegacy.
                </p>
            </div>
        </div>
    `;

    try {
        // Prepare image attachments
        const attachments = [];
        if (images && images.length > 0) {
            images.forEach((img, index) => {
                // Images are stored as base64 strings
                const base64Data = img.buffer.replace(/^data:image\/\w+;base64,/, '');
                attachments.push({
                    filename: img.filename || `pet-photo-${index + 1}.jpg`,
                    content: base64Data,
                    encoding: 'base64',
                    cid: `photo${index + 1}` // Content ID for inline display
                });
            });
        }

        await emailTransporter.sendMail({
            from: `"Pegacy Orders" <${process.env.EMAIL_USER}>`,
            to: NOTIFICATION_EMAIL,
            subject: `New Order: ${orderId} - ${petName || 'Pet Figurine'} (${quantity}x)`,
            html: emailHtml,
            attachments: attachments
        });
        console.log(`✓ Order notification email sent for ${orderId} with ${attachments.length} images`);
        return true;
    } catch (error) {
        console.error('Failed to send email:', error.message);
        return false;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup - store in memory temporarily
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 5
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Temporary image storage (before payment)
const pendingImages = new Map();

// ========================================
// ROUTES
// ========================================

// Health check
app.get('/api/health', async (req, res) => {
    const dbConnected = await db.testConnection();
    res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// ----------------------------------------
// IMAGE UPLOAD - Store temporarily in memory
// ----------------------------------------
app.post('/api/upload', upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Generate a temporary session ID
        const sessionId = uuidv4();

        // Store images in memory with session ID
        const imageData = req.files.map((file, index) => ({
            filename: `angle_${index + 1}_${file.originalname}`,
            mimetype: file.mimetype,
            buffer: file.buffer.toString('base64'),
            size: file.size
        }));

        pendingImages.set(sessionId, {
            images: imageData,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 min expiry
        });

        // Clean up old sessions
        cleanupExpiredSessions();

        res.json({
            success: true,
            sessionId,
            imageCount: imageData.length,
            message: `${imageData.length} images uploaded successfully`
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload images', details: error.message });
    }
});

function cleanupExpiredSessions() {
    const now = new Date();
    for (const [sessionId, data] of pendingImages.entries()) {
        if (data.expiresAt < now) {
            pendingImages.delete(sessionId);
        }
    }
}

// ----------------------------------------
// PRICING CONFIGURATION
// ----------------------------------------
const PRICING = {
    BASE_PRICE: 129,           // $129 per figurine
    SHIPPING_SG: 0,            // Singapore shipping - FREE
    SHIPPING_WORLD: 30,        // Worldwide shipping
    DISCOUNT_PERCENT: 15       // 15% off for 2+ figurines
};

// Valid promo codes (server-side validation)
const PROMO_CODES = {
    'VOKAISTHEBEST': { discount: 5, type: 'percent', description: '5% off' },
    'PEGACYSHOP1': { discount: 10, type: 'percent', description: '10% off' },
    'PEGACYFREE_VOKA': { discount: 100, type: 'percent', description: '100% off' }
};

// Validate promo code
function validatePromoCode(code) {
    if (!code) return null;
    const upperCode = code.toUpperCase().trim();
    return PROMO_CODES[upperCode] ? { code: upperCode, ...PROMO_CODES[upperCode] } : null;
}

// Calculate order total
function calculateOrderTotal(quantity, shippingLocation, promoCode = null) {
    const subtotal = PRICING.BASE_PRICE * quantity;
    const shipping = shippingLocation === 'singapore' ? PRICING.SHIPPING_SG : PRICING.SHIPPING_WORLD;

    // Quantity discount (15% for 2+)
    let quantityDiscount = 0;
    if (quantity >= 2) {
        quantityDiscount = Math.round(subtotal * PRICING.DISCOUNT_PERCENT / 100);
    }

    // Calculate total before promo (subtotal - quantity discount + shipping)
    const totalBeforePromo = subtotal - quantityDiscount + shipping;

    // Promo code discount (applied to entire order including shipping)
    let promoDiscount = 0;
    let validPromo = null;
    if (promoCode) {
        validPromo = validatePromoCode(promoCode);
        if (validPromo && validPromo.type === 'percent') {
            promoDiscount = Math.round(totalBeforePromo * validPromo.discount / 100);
        }
    }

    // Calculate final total (minimum $0.50 SGD for Stripe)
    let total = totalBeforePromo - promoDiscount;
    if (total < 1) {
        total = 1; // Minimum $1 SGD for Stripe (50 cents minimum, but $1 is safer)
    }

    return {
        subtotal,
        quantityDiscount,
        promoDiscount,
        promoCode: validPromo ? validPromo.code : null,
        shipping,
        total
    };
}

// ----------------------------------------
// STRIPE - CREATE PAYMENT INTENT
// ----------------------------------------
app.post('/api/create-payment-intent', express.json(), async (req, res) => {
    try {
        const { email, sessionId, quantity = 1, shippingLocation = 'worldwide', petName, promoCode } = req.body;

        // Validate input
        if (!email) {
            return res.status(400).json({
                error: 'Missing required fields: email required'
            });
        }

        // Verify images were uploaded
        if (!sessionId || !pendingImages.has(sessionId)) {
            return res.status(400).json({
                error: 'No images found. Please upload photos first.'
            });
        }

        // Calculate pricing server-side (don't trust client amount)
        const pricing = calculateOrderTotal(quantity, shippingLocation, promoCode);
        const amount = pricing.total * 100; // Convert to cents

        // Generate order ID
        const orderId = `PGC-${uuidv4().slice(0, 8).toUpperCase()}`;

        // Build description
        let description = quantity === 1
            ? 'Pegacy 3D Pet Figurine - 7cm Premium Edition'
            : `Pegacy 3D Pet Figurines (${quantity}x) - 7cm Premium Edition`;

        if (pricing.promoCode) {
            description += ` (Promo: ${pricing.promoCode})`;
        }

        // Create Stripe PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'sgd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                order_id: orderId,
                quantity: quantity.toString(),
                shipping_location: shippingLocation,
                pet_name: petName || 'Not specified',
                email,
                session_id: sessionId,
                subtotal: pricing.subtotal.toString(),
                quantity_discount: pricing.quantityDiscount.toString(),
                promo_code: pricing.promoCode || '',
                promo_discount: pricing.promoDiscount.toString(),
                shipping: pricing.shipping.toString()
            },
            receipt_email: email,
            description
        });

        // Save order to database
        await db.saveOrder({
            orderId,
            email,
            size: '7cm',
            quantity,
            shippingLocation,
            subtotal: pricing.subtotal,
            discount: pricing.quantityDiscount + pricing.promoDiscount,
            promoCode: pricing.promoCode,
            promoDiscount: pricing.promoDiscount,
            shipping: pricing.shipping,
            amount: pricing.total,
            paymentIntentId: paymentIntent.id,
            petName: petName || null
        });

        // Link session to order for later image saving
        const session = pendingImages.get(sessionId);
        session.orderId = orderId;
        pendingImages.set(sessionId, session);

        res.json({
            clientSecret: paymentIntent.client_secret,
            orderId,
            pricing,
            amount: pricing.total
        });

    } catch (error) {
        console.error('Payment intent error:', error);
        res.status(500).json({ error: 'Failed to create payment', details: error.message });
    }
});

// ----------------------------------------
// STRIPE WEBHOOK
// ----------------------------------------
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment success
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;
        const sessionId = paymentIntent.metadata.session_id;

        console.log(`\n✅ Payment succeeded for order ${orderId}`);

        try {
            // Update order status in database
            await db.updateOrderStatus(orderId, 'paid', { paidAt: new Date() });

            // Get session data for images
            const session = pendingImages.get(sessionId);
            let images = null;

            if (session && session.images) {
                images = session.images;
                await db.saveOrderImages(orderId, images);
                console.log(`✓ Saved ${images.length} images to database`);

                // Clean up temporary storage
                pendingImages.delete(sessionId);
            }

            // Send email notification to pegacysg@gmail.com
            const orderData = {
                orderId,
                email: paymentIntent.metadata.email,
                petName: paymentIntent.metadata.pet_name,
                quantity: parseInt(paymentIntent.metadata.quantity) || 1,
                shippingLocation: paymentIntent.metadata.shipping_location,
                subtotal: parseFloat(paymentIntent.metadata.subtotal) || 0,
                discount: (parseFloat(paymentIntent.metadata.quantity_discount) || 0) + (parseFloat(paymentIntent.metadata.promo_discount) || 0),
                promoCode: paymentIntent.metadata.promo_code || null,
                promoDiscount: parseFloat(paymentIntent.metadata.promo_discount) || 0,
                shipping: parseFloat(paymentIntent.metadata.shipping) || 0,
                amount: paymentIntent.amount / 100
            };

            await sendOrderNotification(orderData, images);

            console.log(`✓ Order ${orderId} completed successfully\n`);

        } catch (error) {
            console.error('Error processing payment:', error);
        }
    }

    res.json({ received: true });
});

// ----------------------------------------
// ORDER CONFIRMATION (called by frontend)
// ----------------------------------------
app.post('/api/confirm-order', express.json(), async (req, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;

        // Verify the payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            // Update order status
            const order = await db.updateOrderStatus(orderId, 'confirmed', {
                confirmedAt: new Date()
            });

            res.json({
                success: true,
                orderId,
                message: 'Order confirmed successfully',
                email: order?.email
            });
        } else {
            res.status(400).json({
                error: 'Payment not completed',
                status: paymentIntent.status
            });
        }

    } catch (error) {
        console.error('Order confirmation error:', error);
        res.status(500).json({ error: 'Failed to confirm order' });
    }
});

// ----------------------------------------
// GET ORDER STATUS
// ----------------------------------------
app.get('/api/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await db.getOrder(orderId);

        if (order) {
            res.json({
                orderId: order.order_id,
                status: order.status,
                size: order.size,
                amount: parseFloat(order.amount),
                createdAt: order.created_at
            });
        } else {
            res.status(404).json({ error: 'Order not found' });
        }
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// ----------------------------------------
// ADMIN: GET ALL ORDERS
// ----------------------------------------
app.get('/api/admin/orders', async (req, res) => {
    // In production, add authentication here!
    try {
        const orders = await db.getAllOrders();
        res.json({ orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ----------------------------------------
// SERVE FRONTEND
// ----------------------------------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ----------------------------------------
// ERROR HANDLER
// ----------------------------------------
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ----------------------------------------
// START SERVER
// ----------------------------------------
async function startServer() {
    try {
        // Initialize database
        if (process.env.DATABASE_URL) {
            await db.initDatabase();
        } else {
            console.log('⚠ DATABASE_URL not set - running without database');
        }

        // Initialize email
        initEmailTransporter();

        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════╗
║           PEGACY Server Started               ║
╠═══════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                   ║
║  Mode: ${(process.env.NODE_ENV || 'development').padEnd(12)}                   ║
║  Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ Connected' : '✗ Not set'}                      ║
║  Database: ${process.env.DATABASE_URL ? '✓ Connected' : '✗ Not set'}                    ║
╚═══════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
