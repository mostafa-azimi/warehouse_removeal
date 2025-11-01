import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken, customerAccountId, skus } = body

    console.log('=== SPECIFIC SKUs QUERY ===')
    console.log(`Customer Account: ${customerAccountId}`)
    console.log(`SKUs to fetch: ${skus.length}`)

    if (!accessToken || !customerAccountId || !skus || !Array.isArray(skus)) {
      return NextResponse.json({ 
        error: 'Missing required parameters: accessToken, customerAccountId, and skus array' 
      }, { status: 400 })
    }

    const allProducts: any[] = []
    
    // Query SKUs SEQUENTIALLY with delays to respect credit limits
    // Each query costs ~511 credits
    // Credits regenerate at 60/second
    // Need 511/60 = 8.5 seconds to regenerate enough for one query
    const DELAY_BETWEEN_QUERIES = 10000 // 10 seconds to be safe
    
    console.log(`Processing ${skus.length} SKUs SEQUENTIALLY`)
    console.log(`Delay: ${DELAY_BETWEEN_QUERIES/1000} seconds between queries`)
    console.log(`Estimated time: ~${Math.round(skus.length * DELAY_BETWEEN_QUERIES / 60000)} minutes`)
    
    for (let i = 0; i < skus.length; i++) {
      const sku = skus[i]
      const skuNumber = i + 1
      
      console.log(`\n📦 SKU ${skuNumber}/${skus.length}: ${sku}`)
      
      // Query this single SKU
      const result = await (async () => {
        const query = `
          query GetSKULocations($customer_account_id: String!, $sku: String!) {
            warehouse_products(customer_account_id: $customer_account_id, sku: $sku) {
              request_id
              complexity
              data(first: 10) {
                edges {
                  node {
                    id
                    account_id
                    on_hand
                    warehouse_identifier
                    inventory_bin
                    product {
                      sku
                      name
                    }
                    locations(first: 50) {
                      edges {
                        node {
                          quantity
                          location {
                            name
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
          }
        `

        const variables = {
          customer_account_id: customerAccountId,
          sku: sku
        }

      try {
        const response = await fetch('https://public-api.shiphero.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ query, variables })
        })

        if (!response.ok) {
          console.error(`❌ HTTP ${response.status}`)
          return null
        }

        const data = await response.json()
        
        if (data.errors) {
          console.error(`❌ GraphQL error:`, data.errors[0]?.message)
          return null
        }

        const edges = data?.data?.warehouse_products?.data?.edges || []
        
        if (edges.length === 0) {
          console.warn(`⚠️ Not found for account ${customerAccountId}`)
          return null
        }
        
        console.log(`✅ Found with ${edges[0]?.node?.on_hand || 0} units`)
        return edges[0] // Return the product node
      } catch (error: any) {
        console.error(`❌ Error:`, error.message)
        return null
      }
      })()
      
      if (result) {
        allProducts.push(result)
      }
      
      // Delay before next SKU (except for the last one)
      if (i < skus.length - 1) {
        const waitSeconds = DELAY_BETWEEN_QUERIES / 1000
        console.log(`⏳ Waiting ${waitSeconds}s for credit regeneration...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_QUERIES))
      }
    }

    console.log(`\n=== QUERY COMPLETE ===`)
    console.log(`Total SKUs requested: ${skus.length}`)
    console.log(`Total SKUs found: ${allProducts.length}`)
    console.log(`Missing: ${skus.length - allProducts.length}`)

    // Return in the same format as product-locations route
    const finalData = {
      data: {
        warehouse_products: {
          data: {
            edges: allProducts
          }
        }
      },
      _accountId: customerAccountId,
      _queryType: 'specific_skus',
      _stats: {
        requested: skus.length,
        found: allProducts.length,
        missing: skus.length - allProducts.length
      }
    }

    return NextResponse.json(finalData)

  } catch (error: any) {
    console.error('Specific SKUs query error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

