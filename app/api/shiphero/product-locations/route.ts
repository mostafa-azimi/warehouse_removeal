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

    // Using the simplified query to troubleshoot 400 errors
    const query = `
      query GetProductLocations($customer_account_id: String!) {
        warehouse_products(customer_account_id: $customer_account_id) {
          request_id
          complexity
          data(first: 50) {
            edges {
              node {
                id
                on_hand
                inventory_bin
                product {
                  sku
                  name
                }
                locations(first: 10) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      pickable
                      sellable
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    // Try both numeric and encoded account ID formats
    const numericAccountId = customerAccountId
    const encodedAccountId = btoa(`Account:${customerAccountId}`)
    
    console.log('[PRODUCT LOCATIONS API] Testing both account ID formats:', {
      numeric: numericAccountId,
      encoded: encodedAccountId
    })

    // Start with numeric format
    const variables = {
      customer_account_id: numericAccountId
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
      console.log('[PRODUCT LOCATIONS API] First attempt failed, trying encoded account ID format...')
      
      // If numeric format failed, try encoded format
      const encodedVariables = {
        customer_account_id: encodedAccountId
      }
      
      const encodedRequestBody = { query, variables: encodedVariables }
      
      console.log('[PRODUCT LOCATIONS API] Retrying with encoded account ID:', encodedRequestBody)
      
      await delay(1000) // Brief delay before retry
      
      const retryResponse = await fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(encodedRequestBody)
      })
      
      console.log('[PRODUCT LOCATIONS API] Retry response status:', retryResponse.status)
      
      if (!retryResponse.ok) {
        // Both formats failed, return the original error
        let errorDetails
        try {
          errorDetails = JSON.parse(errorText)
          console.log('[PRODUCT LOCATIONS API] Both formats failed. Original error:', JSON.stringify(errorDetails, null, 2))
        } catch (e) {
          console.log('[PRODUCT LOCATIONS API] Could not parse error response as JSON')
          errorDetails = errorText
        }
        
        return NextResponse.json(
          { 
            error: `ShipHero API error: Both numeric (${numericAccountId}) and encoded (${encodedAccountId}) formats failed`, 
            details: errorDetails,
            requestInfo: {
              customerAccountId,
              accountIdFormats: ['numeric', 'encoded'],
              queryUsed: 'warehouse_products'
            }
          },
          { status: response.status }
        )
      }
      
      // Encoded format worked, use that response
      console.log('[PRODUCT LOCATIONS API] Encoded format worked! Using retry response.')
      response = retryResponse
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
