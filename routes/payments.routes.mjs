import express from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { authenticate, requireCompanyRole } from '../middleware/auth.mjs'
import { createCharge, getCharge, getYocoConfig } from '../lib/yoco.mjs'

const router = express.Router()

// GET /api/payments/config
router.get('/config', authenticate, async (req, res) => {
  const [[company]] = await db.query(
    'SELECT yoco_public_key, currency FROM companies WHERE id = ?',
    [req.user.company_id]
  )
  res.json({
    yocoEnabled: !!company?.yoco_public_key,
    publicKey: company?.yoco_public_key || null,
    currency: company?.currency || 'ZAR',
  })
})

// PUT /api/payments/config — admin only
router.put('/config', authenticate, requireCompanyRole('owner', 'admin'), async (req, res) => {
  const { yocoPublicKey, yocoSecretKey, yocoWebhookSecret } = req.body

  await db.query(
    `UPDATE companies SET
       yoco_public_key = COALESCE(?, yoco_public_key),
       yoco_secret_key = COALESCE(?, yoco_secret_key),
       yoco_webhook_secret = COALESCE(?, yoco_webhook_secret)
     WHERE id = ?`,
    [yocoPublicKey || null, yocoSecretKey || null, yocoWebhookSecret || null, req.user.company_id]
  )

  res.json({ message: 'Yoco configuration updated' })
})

// POST /api/payments/charge — process Yoco token from frontend popup
router.post('/charge', authenticate, async (req, res) => {
  const { token, amountInCents, currency, metadata } = req.body

  if (!token || !amountInCents) {
    return res.status(400).json({ error: 'Token and amount are required' })
  }

  try {
    const config = await getYocoConfig(req.user.company_id)
    if (!config) {
      return res.status(400).json({ error: 'Yoco is not configured. Add keys in Settings.' })
    }

    const charge = await createCharge(req.user.company_id, {
      token,
      amountInCents,
      currency: currency || config.currency,
      metadata,
    })

    if (charge.status !== 'successful') {
      return res.status(402).json({ error: 'Payment was not successful', charge })
    }

    res.json({ charge })
  } catch (err) {
    console.error('Yoco charge error:', err)
    res.status(400).json({ error: err.message || 'Charge failed' })
  }
})

// GET /api/payments/charge/:chargeId
router.get('/charge/:chargeId', authenticate, async (req, res) => {
  try {
    const charge = await getCharge(req.user.company_id, req.params.chargeId)
    res.json({ charge })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/payments/webhook — Yoco webhook (raw body handled in server.js)
export async function yocoWebhookHandler(req, res) {
  const signature = req.headers['x-yoco-signature']
  const payload = req.body

  try {
    if (signature && payload?.company_id) {
      const [[company]] = await db.query(
        'SELECT yoco_webhook_secret FROM companies WHERE id = ?',
        [payload.company_id]
      )
      if (company?.yoco_webhook_secret) {
        const expected = crypto
          .createHmac('sha256', company.yoco_webhook_secret)
          .update(JSON.stringify(payload))
          .digest('hex')
        if (signature !== expected) {
          return res.status(401).json({ error: 'Invalid webhook signature' })
        }
      }
    }

    if (payload?.type === 'payment.succeeded' || payload?.status === 'successful') {
      const chargeId = payload.data?.id || payload.id
      if (chargeId) {
        await db.query(
          "UPDATE payments SET status = 'completed' WHERE yoco_charge_id = ?",
          [chargeId]
        )
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Yoco webhook error:', err)
    res.status(400).json({ error: 'Webhook failed' })
  }
}

export default router
