/**
 * Database Module - PostgreSQL
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
    const client = await pool.connect();

    try {
        // Create orders table with all pricing fields
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(255) NOT NULL,
                pet_name VARCHAR(255),
                size VARCHAR(20) NOT NULL DEFAULT '7cm',
                quantity INTEGER NOT NULL DEFAULT 1,
                shipping_location VARCHAR(50) DEFAULT 'worldwide',
                subtotal DECIMAL(10,2),
                discount DECIMAL(10,2) DEFAULT 0,
                shipping DECIMAL(10,2),
                amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                payment_intent_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP,
                confirmed_at TIMESTAMP
            )
        `);

        // Add new columns if they don't exist (for existing databases)
        const alterQueries = [
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS pet_name VARCHAR(255)`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_location VARCHAR(50) DEFAULT 'worldwide'`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2)`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping DECIMAL(10,2)`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50)`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount DECIMAL(10,2) DEFAULT 0`
        ];

        for (const query of alterQueries) {
            try {
                await client.query(query);
            } catch (e) {
                // Column might already exist, ignore
            }
        }

        // Create order_images table (stores base64 images)
        await client.query(`
            CREATE TABLE IF NOT EXISTS order_images (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(20) REFERENCES orders(order_id),
                angle INTEGER NOT NULL,
                filename VARCHAR(255),
                mimetype VARCHAR(100),
                image_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create index for faster lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)
        `);

        console.log('✓ Database tables initialized');

    } finally {
        client.release();
    }
}

// Save a new order
async function saveOrder(orderData) {
    const {
        orderId,
        email,
        petName,
        size = '7cm',
        quantity = 1,
        shippingLocation = 'worldwide',
        subtotal,
        discount = 0,
        promoCode = null,
        promoDiscount = 0,
        shipping,
        amount,
        paymentIntentId
    } = orderData;

    const result = await pool.query(
        `INSERT INTO orders (
            order_id, email, pet_name, size, quantity, shipping_location,
            subtotal, discount, promo_code, promo_discount, shipping, amount, payment_intent_id, status
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
         RETURNING *`,
        [orderId, email, petName, size, quantity, shippingLocation, subtotal, discount, promoCode, promoDiscount, shipping, amount, paymentIntentId]
    );

    return result.rows[0];
}

// Save images for an order
async function saveOrderImages(orderId, images) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            await client.query(
                `INSERT INTO order_images (order_id, angle, filename, mimetype, image_data)
                 VALUES ($1, $2, $3, $4, $5)`,
                [orderId, i + 1, img.filename, img.mimetype, img.buffer]
            );
        }

        await client.query('COMMIT');
        console.log(`✓ Saved ${images.length} images for order ${orderId}`);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Update order status
async function updateOrderStatus(orderId, status, extraFields = {}) {
    let setClause = 'status = $2';
    let values = [orderId, status];
    let paramCount = 2;

    if (extraFields.paidAt) {
        paramCount++;
        setClause += `, paid_at = $${paramCount}`;
        values.push(extraFields.paidAt);
    }

    if (extraFields.confirmedAt) {
        paramCount++;
        setClause += `, confirmed_at = $${paramCount}`;
        values.push(extraFields.confirmedAt);
    }

    const result = await pool.query(
        `UPDATE orders SET ${setClause} WHERE order_id = $1 RETURNING *`,
        values
    );

    return result.rows[0];
}

// Get order by ID
async function getOrder(orderId) {
    const result = await pool.query(
        'SELECT * FROM orders WHERE order_id = $1',
        [orderId]
    );
    return result.rows[0];
}

// Get order with images
async function getOrderWithImages(orderId) {
    const order = await getOrder(orderId);

    if (!order) return null;

    const images = await pool.query(
        'SELECT angle, filename, mimetype FROM order_images WHERE order_id = $1 ORDER BY angle',
        [orderId]
    );

    return {
        ...order,
        images: images.rows
    };
}

// Get all orders (for admin)
async function getAllOrders(limit = 50) {
    const result = await pool.query(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

// Test database connection
async function testConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
}

module.exports = {
    pool,
    initDatabase,
    saveOrder,
    saveOrderImages,
    updateOrderStatus,
    getOrder,
    getOrderWithImages,
    getAllOrders,
    testConnection
};
