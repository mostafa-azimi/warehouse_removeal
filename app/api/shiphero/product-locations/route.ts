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

    // Fetch ALL products with pagination
    let allProducts: any[] = []
    let hasNextPage = true
    let cursor: string | null = null
    let pageCount = 0
    const MAX_PAGES = 50 // Increased to handle 426 products (need ~9 pages at 50 per page)

    console.log('Starting pagination to fetch ALL products (up to 50 pages)...')
    console.log('Target: Fetch all 426+ products from ShipHero')

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
                  on_hand
                  inventory_bin
                  product {
                    sku
                    name
                  }
                  locations(first: 100) {
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
      
      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        
        // Check for credit limit errors
        const creditError = data.errors.find((e: any) => e.code === 30)
        if (creditError) {
          console.warn(`Credit limit reached at page ${pageCount}. Returning partial results.`)
          break
        }
        
        return NextResponse.json({ 
          error: 'ShipHero GraphQL error',
          details: data.errors
        }, { status: 400 })
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
      
      // Delay between requests to avoid overwhelming the API and respect credit limits
      if (hasNextPage && pageCount < MAX_PAGES) {
        console.log(`Waiting 500ms before next page to respect rate limits...`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log(`=== PAGINATION COMPLETE ===`)
    console.log(`Total pages fetched: ${pageCount}`)
    console.log(`Total products: ${allProducts.length}`)

    // Return data in the same format as before, with pagination metadata
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
      }
    }
    
    console.log('📊 Returning final data with', allProducts.length, 'products')
    
    return NextResponse.json(finalData);
    
  } catch (error: any) {
    console.error('=== API ERROR ===', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}