import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache for product location data
interface CacheEntry {
  data: any
  timestamp: number
  accessToken: string
  customerAccountId: string
}

const productLocationCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes (product data changes more frequently)

export async function POST(request: NextRequest) {
  try {
    console.log('ShipHero product locations API route called (POST)')
    const body = await request.json()
    const { accessToken, customerAccountId } = body
    
    console.log('Access token received:', accessToken ? 'Present' : 'Missing')
    console.log('Customer account ID:', customerAccountId)
    
    if (!accessToken) {
      console.log('No access token provided')
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    if (!customerAccountId) {
      console.log('No customer account ID provided')
      return NextResponse.json({ error: 'Customer account ID required' }, { status: 400 })
    }

    return await fetchProductLocations(accessToken, customerAccountId)
  } catch (error: any) {
    console.error('ShipHero product locations API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

async function fetchProductLocations(accessToken: string, customerAccountId: string) {
  try {
    // Check cache first for faster loading
    const cacheKey = `products_${customerAccountId}_${accessToken.substring(0, 10)}`
    const cachedEntry = productLocationCache.get(cacheKey)
    const now = Date.now()
    
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION && cachedEntry.accessToken === accessToken) {
      console.log('🚀 Returning cached product location data (faster loading)')
      return NextResponse.json({
        ...cachedEntry.data,
        cached: true,
        cacheAge: Math.round((now - cachedEntry.timestamp) / 1000)
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minutes client-side cache
        }
      })
    }

    // Query with locations - but with smaller batch size to manage credits
    // Each product with locations is expensive, so we'll do smaller batches
    const query = `
      query GetProductLocationsByClient($customer_account_id: String!, $first: Int = 100) {
        warehouse_products(customer_account_id: $customer_account_id) {
          request_id
          complexity
          data(first: $first) {
            edges {
              node {
                id
                account_id
                on_hand
                inventory_bin
                product {
                  id
                  name
                  sku
                  barcode
                }
                warehouse {
                  id
                }
                locations(first: 20) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      warehouse_id
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `

    // Much smaller batch size since locations are expensive
    const variables = {
      customer_account_id: customerAccountId,
      first: 15  // Very small batch to stay within credit limits with location data
    }

    const requestBody = { query, variables }
    
    console.log('[PRODUCT LOCATIONS API] Detailed request info:', {
      customerAccountId,
      accountIdType: 'Direct numeric string (3PL format)',
      variables,
      accessTokenLength: accessToken.length,
      accessTokenPrefix: accessToken.substring(0, 20)
    })
    
    console.log('[PRODUCT LOCATIONS API] Full GraphQL request:', JSON.stringify(requestBody, null, 2))

    // Add delay to respect API rate limits and credit regeneration
    // ShipHero regenerates 30 credits per second according to the logs
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    
    console.log('[PRODUCT LOCATIONS API] Adding 2-second delay to respect rate limits...')
    await delay(2000) // 2 second delay to allow credit regeneration
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('[PRODUCT LOCATIONS API] ShipHero response status:', response.status)
    console.log('[PRODUCT LOCATIONS API] ShipHero response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('[PRODUCT LOCATIONS API] ShipHero error response (raw):', errorText)
      
      // Try to parse the error as JSON for more details
      let errorDetails
      try {
        errorDetails = JSON.parse(errorText)
        console.log('[PRODUCT LOCATIONS API] ShipHero error response (parsed):', JSON.stringify(errorDetails, null, 2))
      } catch (e) {
        console.log('[PRODUCT LOCATIONS API] Could not parse error response as JSON')
        errorDetails = errorText
      }
      
      return NextResponse.json(
        { 
          error: `ShipHero API error: ${response.status} ${response.statusText}`, 
          details: errorDetails,
          requestInfo: {
            customerAccountId,
            accountIdFormat: 'Direct numeric string',
            queryUsed: 'warehouse_products'
          }
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[PRODUCT LOCATIONS API] ShipHero response structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      warehouseProducts: !!data.data?.warehouse_products,
      fullResponse: JSON.stringify(data, null, 2)
    })
    
    // Check for GraphQL errors even with 200 status
    if (data.errors && data.errors.length > 0) {
      console.log('[PRODUCT LOCATIONS API] GraphQL errors found:', data.errors)
      
      // Check for credit limit errors specifically
      const creditError = data.errors.find((error: any) => error.code === 30)
      if (creditError) {
        return NextResponse.json(
          { 
            error: 'ShipHero API Credit Limit Exceeded', 
            message: `This customer account has too much inventory to query all at once. Required: ${creditError.required_credits} credits, Available: ${creditError.remaining_credits} credits.`,
            suggestion: 'Try querying a smaller subset of products or contact ShipHero to increase your API credit limits.',
            details: data.errors,
            requestInfo: {
              customerAccountId,
              accountIdFormat: 'Direct numeric string',
              queryUsed: 'warehouse_products',
              batchSize: variables.first
            }
          },
          { status: 429 } // 429 Too Many Requests is appropriate for rate limiting
        )
      }
      
      return NextResponse.json(
        { 
          error: 'GraphQL errors in response', 
          details: data.errors,
          requestInfo: {
            customerAccountId,
            accountIdFormat: 'Direct numeric string',
            queryUsed: 'warehouse_products'
          }
        },
        { status: 400 }
      )
    }
    
    // Cache the result for faster subsequent loads
    productLocationCache.set(cacheKey, {
      data: { ...data, cached: false, cacheAge: 0 },
      timestamp: now,
      accessToken,
      customerAccountId
    })

    // Clean up old cache entries
    for (const [key, entry] of productLocationCache.entries()) {
      if ((now - entry.timestamp) > CACHE_DURATION * 2) {
        productLocationCache.delete(key)
      }
    }

    return NextResponse.json({
      ...data,
      cached: false,
      cacheAge: 0
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutes client-side cache
      }
    })

  } catch (error: any) {
    console.error('ShipHero product locations API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
