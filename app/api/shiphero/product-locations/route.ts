import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('=== SHIPHERO API DEBUG ===');
    
    const requestBody = await request.json()
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const { accessToken, customerAccountId } = requestBody
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 401 })
    }

    if (!customerAccountId) {
      return NextResponse.json({ error: 'Customer account ID is required' }, { status: 400 })
    }

    console.log('=== TWO-STEP QUERY APPROACH ===')
    console.log('Step 1: Get all SKUs for customer account')
    console.log('Step 2: Query locations for each SKU individually')
    
    // STEP 1: Get all SKUs for this customer account
    console.log('📦 STEP 1: Fetching SKU list...')
    
    let allSkus: string[] = []
    let hasNextPage = true
    let cursor: string | null = null
    let pageCount = 0
    const MAX_PAGES = 50

    while (hasNextPage && pageCount < MAX_PAGES) {
      pageCount++
      console.log(`Fetching page ${pageCount}...`)

      const query = `
        query GetProductLocations($customer_account_id: String!, $after: String) {
          warehouse_products(customer_account_id: $customer_account_id) {
            request_id
            complexity
            data(first: 50, after: $after) {
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
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;

      const variables = {
        customer_account_id: customerAccountId,
        after: cursor
      }
      
      const graphqlRequestBody = { query, variables }
      
      const response = await fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(graphqlRequestBody)
      });
      
      const responseText = await response.text();
      console.log(`Page ${pageCount} Response Status:`, response.status);
      
      if (!response.ok) {
        throw new Error(`ShipHero API error: ${response.status} - ${responseText}`);
      }
      
      const data = JSON.parse(responseText);
      
      // Log account_id for first few products to verify ShipHero's filtering
      if (pageCount === 1) {
        const edges = data?.data?.warehouse_products?.data?.edges || []
        console.log('🔍 VERCEL LOG: Checking account IDs from ShipHero API...')
        console.log(`🔍 VERCEL LOG: Requested account: ${customerAccountId}`)
        if (edges.length > 0) {
          console.log('=== 🔍 ACCOUNT ID VERIFICATION (First 10 products) ===')
          console.log('NOTE: Checking warehouse_product.account_id (should match customer_account_id if filtering works)')
          edges.slice(0, 10).forEach((edge: any, idx: number) => {
            const sku = edge?.node?.product?.sku
            const warehouseProductAccountId = edge?.node?.account_id
            const productAccountId = edge?.node?.product?.account_id
            
            console.log(`  ${idx + 1}. SKU: ${sku}`)
            console.log(`      warehouse_product.account_id: ${warehouseProductAccountId}`)
            console.log(`      product.account_id: ${productAccountId}`)
            
            // Try to decode warehouse_product account_id
            if (warehouseProductAccountId) {
              try {
                const decoded = Buffer.from(warehouseProductAccountId, 'base64').toString('utf-8')
                const plainId = decoded.split(':')[1]
                console.log(`      warehouse_product decoded: ${plainId} ${plainId === customerAccountId ? '✅ MATCH' : '❌ MISMATCH'}`)
              } catch (e) {
                console.log(`      warehouse_product account_id: ${warehouseProductAccountId} (not base64)`)
              }
            }
          })
          console.log('=== END ACCOUNT ID VERIFICATION ===')
        } else {
          console.log('⚠️ No products returned on page 1!')
        }
      }
      
      if (data.errors) {
        console.error(`⚠️ GraphQL Errors on page ${pageCount}:`, JSON.stringify(data.errors, null, 2));
        
        // Check for credit limit errors
        const creditError = data.errors.find((e: any) => e.code === 30)
        if (creditError) {
          console.warn(`💳 Credit limit reached at page ${pageCount}`)
          console.warn(`Required: ${creditError.required_credits}, Available: ${creditError.remaining_credits}`)
          console.warn(`Returning partial results: ${allProducts.length} products`)
          break
        }
        
        // For other errors on page 1, return error
        if (pageCount === 1) {
          console.error('❌ Error on first page - aborting')
          return NextResponse.json({ 
            error: 'ShipHero GraphQL error',
            details: data.errors
          }, { status: 400 })
        }
        
        // For errors on subsequent pages, return what we have
        console.warn(`Continuing with ${allProducts.length} products from previous pages`)
        break
      }

      const edges = data.data?.warehouse_products?.data?.edges || []
      const pageInfo = data.data?.warehouse_products?.data?.pageInfo
      
      console.log(`✅ Page ${pageCount}: Fetched ${edges.length} products`)
      console.log(`📊 PageInfo:`, JSON.stringify(pageInfo, null, 2))
      allProducts = allProducts.concat(edges)
      
      hasNextPage = pageInfo?.hasNextPage || false
      cursor = pageInfo?.endCursor || null
      
      console.log(`📈 Total products so far: ${allProducts.length}`)
      console.log(`🔄 Has next page: ${hasNextPage}`)
      console.log(`🔑 Cursor for next page: ${cursor}`)
      
      if (!hasNextPage) {
        console.log(`🛑 Pagination stopping - hasNextPage is false`)
        console.log(`🛑 Final product count: ${allProducts.length} of expected 426`)
        if (allProducts.length < 426) {
          console.warn(`⚠️ MISSING ${426 - allProducts.length} PRODUCTS!`)
        }
      }
      
      // Calculate delay based on credits needed
      // ShipHero regenerates 60 credits/second
      // Each page (50 products with inventory_bins) costs less than the old locations query
      // Wait 10 seconds = regenerate 600 credits (should be sufficient with simpler query)
      if (hasNextPage && pageCount < MAX_PAGES) {
        const delaySeconds = 10
        console.log(`⏳ Waiting ${delaySeconds} seconds to regenerate credits...`)
        console.log(`   Regenerates ~${delaySeconds * 60} credits`)
        console.log(`   Using inventory_bins query (simpler than locations)`)
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
      }
    }

    console.log(`=== PAGINATION COMPLETE ===`)
    console.log(`Total pages fetched: ${pageCount}`)
    console.log(`Total products: ${allProducts.length}`)

    // Return data in the same format as before, with pagination metadata and account ID for validation
    const finalData = {
      data: {
        warehouse_products: {
          data: {
            edges: allProducts
          }
        }
      },
      _pagination: {
        totalPages: pageCount,
        totalProducts: allProducts.length,
        expectedProducts: 426,
        completedSuccessfully: pageCount < MAX_PAGES || !hasNextPage,
        stoppedEarly: hasNextPage && pageCount >= MAX_PAGES
      },
      _accountId: customerAccountId // Pass through for validation
    }
    
    console.log('📊 Returning final data with', allProducts.length, 'products')
    
    return NextResponse.json(finalData);
    
  } catch (error: any) {
    console.error('=== API ERROR ===', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}