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
    
    // Query SKUs in batches of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10
    const DELAY_BETWEEN_BATCHES = 2000 // 2 seconds
    
    console.log(`Processing ${skus.length} SKUs in batches of ${BATCH_SIZE}`)
    
    for (let i = 0; i < skus.length; i += BATCH_SIZE) {
      const batch = skus.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(skus.length / BATCH_SIZE)
      
      console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: Fetching ${batch.length} SKUs`)
      console.log(`   SKUs: ${batch.join(', ')}`)
      
      // Query all SKUs in this batch in parallel
      const batchPromises = batch.map(async (sku) => {
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
            console.error(`❌ SKU ${sku}: HTTP ${response.status}`)
            return null
          }

          const data = await response.json()
          
          if (data.errors) {
            console.error(`❌ SKU ${sku}: GraphQL error:`, data.errors[0]?.message)
            return null
          }

          const edges = data?.data?.warehouse_products?.data?.edges || []
          
          if (edges.length === 0) {
            console.warn(`⚠️ SKU ${sku}: Not found for account ${customerAccountId}`)
            return null
          }
          
          console.log(`✅ SKU ${sku}: Found with ${edges[0]?.node?.on_hand || 0} units`)
          return edges[0] // Return the product node
        } catch (error: any) {
          console.error(`❌ SKU ${sku}: Error -`, error.message)
          return null
        }
      })

      // Wait for all SKUs in this batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Add successful results to allProducts
      batchResults.forEach((result, idx) => {
        if (result) {
          allProducts.push(result)
        }
      })
      
      console.log(`✅ Batch ${batchNumber} complete: ${batchResults.filter(r => r).length}/${batch.length} SKUs found`)
      
      // Delay before next batch (except for the last batch)
      if (i + BATCH_SIZE < skus.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
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

