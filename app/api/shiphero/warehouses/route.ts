import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache for warehouse data
interface CacheEntry {
  data: any
  timestamp: number
  accessToken: string
}

const warehouseCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes (warehouses change less frequently)

export async function GET(request: NextRequest) {
  try {
    console.log('ShipHero warehouses API route called')
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    console.log('Access token received:', accessToken ? 'Present' : 'Missing')
    
    if (!accessToken) {
      console.log('No access token provided')
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    // Check cache first for faster loading
    const cacheKey = `warehouses_${accessToken.substring(0, 10)}`
    const cachedEntry = warehouseCache.get(cacheKey)
    const now = Date.now()
    
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION && cachedEntry.accessToken === accessToken) {
      console.log('🚀 Returning cached warehouse data (faster loading)')
      return NextResponse.json({
        ...cachedEntry.data,
        cached: true,
        cacheAge: Math.round((now - cachedEntry.timestamp) / 1000)
      }, {
        headers: {
          'Cache-Control': 'public, max-age=600', // 10 minutes client-side cache
        }
      })
    }

    // Use the correct GraphQL query structure from the documentation
    const query = `
      query {
        account {
          request_id
          complexity
          data {
            warehouses {
              id
              legacy_id
              identifier
              account_id
              address {
                name
                address1
                address2
                city
                state
                country
                zip
                phone
              }
              dynamic_slotting
              invoice_email
              phone_number
              profile
            }
          }
        }
      }
    `

    const requestBody = { query }
    console.log('Sending request to ShipHero:', {
      url: 'https://public-api.shiphero.com/graphql',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken.substring(0, 10)}...`
      },
      body: requestBody
    })

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('ShipHero response status:', response.status)
    console.log('ShipHero response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('ShipHero error response:', errorText)
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Cache the result for faster subsequent loads
    warehouseCache.set(cacheKey, {
      data: { ...data, cached: false, cacheAge: 0 },
      timestamp: now,
      accessToken
    })

    // Clean up old cache entries
    for (const [key, entry] of warehouseCache.entries()) {
      if ((now - entry.timestamp) > CACHE_DURATION * 2) {
        warehouseCache.delete(key)
      }
    }

    return NextResponse.json({
      ...data,
      cached: false,
      cacheAge: 0
    }, {
      headers: {
        'Cache-Control': 'public, max-age=600', // 10 minutes client-side cache
      }
    })

  } catch (error: any) {
    console.error('ShipHero warehouses API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
