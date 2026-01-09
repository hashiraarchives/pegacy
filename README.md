# Pegacy - Premium 3D Pet Figurines

Transform your beloved pet into a stunning 7cm 3D printed figurine. State-of-the-art 3D printing meets artisan craftsmanship for an exact replica of your best friend.

## Features

- Warm, professional landing page showcasing real product images
- 3-step order flow: Upload Photos → Enter Details → Secure Payment
- Stripe integration for payments
- PostgreSQL database for orders and image storage
- Railway-ready deployment

## Tech Stack

- **Frontend**: HTML, Tailwind CSS, Vanilla JS, Lucide Icons
- **Backend**: Node.js, Express
- **Payments**: Stripe
- **Database**: PostgreSQL
- **Hosting**: Railway

## Project Structure

```
pegacy/
├── public/
│   ├── index.html              # Main application
│   └── images/
│       ├── pomeranian-with-figurine.jpg
│       └── cino-transformation.png
├── server/
│   ├── index.js                # Express backend
│   └── db.js                   # PostgreSQL database module
├── uploads/                    # Temporary upload directory
├── package.json
├── railway.json                # Railway config
├── Procfile
├── .env.example                # Environment template
└── README.md
```

## Pricing

| Product | Price | Dimensions |
|---------|-------|------------|
| Premium Pet Figurine | $129 SGD | 7cm (2.75") tall |

**Shipping:**
- Singapore: $10 (~1 week delivery)
- Worldwide: $15 (~2 weeks delivery)

**Discount:** 15% off when ordering 2+ figurines!

*Every figurine includes a crystal acrylic display case*

---

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
DATABASE_URL=postgresql://user:password@localhost:5432/pegacy
```

### 3. Set Up PostgreSQL (Local)

If you have PostgreSQL installed locally:

```bash
createdb pegacy
```

The tables will be created automatically when the server starts.

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Deploy to Railway

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app) and sign up (GitHub recommended)
2. You get $5 free credit/month on the free tier

### Step 2: Create New Project

1. Click **"New Project"** on your Railway dashboard
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub account if not already connected
4. Select your `pegacy` repository

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically set the `DATABASE_URL` environment variable

### Step 4: Configure Environment Variables

In your Railway project, go to **Variables** tab and add:

```
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

> **Important**: Use your **live** Stripe keys for production!

### Step 5: Update Frontend Stripe Key

Before deploying, update the publishable key in `public/index.html`:

```javascript
const CONFIG = {
    STRIPE_PUBLISHABLE_KEY: 'pk_live_your_live_publishable_key',
    API_BASE: '',
    PRICE: 129.99
};
```

### Step 6: Deploy

Railway will automatically deploy when you push to your connected branch. You can also manually trigger a deploy from the dashboard.

### Step 7: Set Up Stripe Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Enter your Railway URL: `https://your-app.up.railway.app/api/webhook`
4. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to Railway as `STRIPE_WEBHOOK_SECRET`

### Step 8: Custom Domain (Optional)

1. In Railway, go to **Settings** → **Domains**
2. Click **"Generate Domain"** for a free `*.up.railway.app` subdomain
3. Or add your custom domain and configure DNS

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (used by Railway) |
| `/api/upload` | POST | Upload 5 pet images |
| `/api/create-payment-intent` | POST | Create Stripe payment intent |
| `/api/webhook` | POST | Stripe webhook handler |
| `/api/confirm-order` | POST | Confirm payment success |
| `/api/order/:orderId` | GET | Get order status |
| `/api/admin/orders` | GET | List all orders (add auth!) |

---

## Testing

### Stripe Test Cards

Use these cards in test mode:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires 3D Secure |

Use any future expiry date and any 3-digit CVC.

---

## Production Checklist

- [ ] Replace Stripe test keys with **live** keys
- [ ] Update frontend with live publishable key
- [ ] Set up Stripe webhook with live endpoint
- [ ] Configure custom domain
- [ ] Add authentication to admin endpoints
- [ ] Set up email notifications (e.g., SendGrid)
- [ ] Enable Stripe receipt emails
- [ ] Set up monitoring/logging

---

## Troubleshooting

### "Database connection failed"
- Ensure PostgreSQL addon is added in Railway
- Check that `DATABASE_URL` is set in environment variables

### "Stripe not configured"
- Verify `STRIPE_SECRET_KEY` is set correctly
- Ensure you're using the right keys (test vs live)

### "Webhook signature verification failed"
- Make sure `STRIPE_WEBHOOK_SECRET` matches your Stripe dashboard
- Ensure the webhook URL is correct

### Images not showing
- Check that images are in `public/images/` folder
- Verify the image paths in `index.html`

---

## License

MIT License - Pegacy 2026
