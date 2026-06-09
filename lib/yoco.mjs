import db from '../db.js'

const YOCO_API_BASE = 'https://online.yoco.com/v1'

export async function getYocoConfig(companyId) {
  const [[company]] = await db.query(
    'SELECT yoco_public_key, yoco_secret_key, currency FROM companies WHERE id = ?',
    [companyId]
  )
  if (!company?.yoco_secret_key) return null
  return {
    publicKey: company.yoco_public_key,
    secretKey: company.yoco_secret_key,
    currency: company.currency || 'ZAR',
  }
}

export async function createCharge(companyId, { token, amountInCents, currency, metadata = {} }) {
  const config = await getYocoConfig(companyId)
  if (!config) throw new Error('Yoco is not configured for this company')

  const response = await fetch(`${YOCO_API_BASE}/charges/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      amountInCents,
      currency: currency || config.currency,
      metadata,
    }),
  })

  const charge = await response.json()
  if (!response.ok) {
    throw new Error(charge.message || charge.errorMessage || 'Yoco charge failed')
  }
  return charge
}

export async function getCharge(companyId, chargeId) {
  const config = await getYocoConfig(companyId)
  if (!config) throw new Error('Yoco is not configured')

  const response = await fetch(`${YOCO_API_BASE}/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` },
  })

  const charge = await response.json()
  if (!response.ok) {
    throw new Error(charge.message || 'Failed to retrieve Yoco charge')
  }
  return charge
}

export async function verifyAndCharge(companyId, token, amountInCents, currency, metadata) {
  const charge = await createCharge(companyId, { token, amountInCents, currency, metadata })
  if (charge.status !== 'successful') {
    throw new Error(`Payment not successful: ${charge.status}`)
  }
  return charge
}
