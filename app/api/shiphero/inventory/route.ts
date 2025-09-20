import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache for inventory data
interface CacheEntry {
  data: any
  timestamp: number
  accessToken: string
}

const inventoryCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  console.log('📦 ShipHero Inventory API called')
  
  try {
    // Get access token from localStorage (client-side) or environment
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '') || 
                       process.env.SHIPHERO_ACCESS_TOKEN

    console.log('🔑 Token check:', {
      hasAuthHeader: !!request.headers.get('authorization'),
      hasEnvToken: !!process.env.SHIPHERO_ACCESS_TOKEN,
      tokenStart: accessToken ? accessToken.substring(0, 20) + '...' : 'none'
    })

    if (!accessToken) {
      console.log('❌ No access token available')
      return NextResponse.json(
        { error: 'No ShipHero access token available' },
        { status: 401 }
      )
    }

    // Check cache first for faster loading
    const cacheKey = `inventory_${accessToken.substring(0, 10)}`
    const cachedEntry = inventoryCache.get(cacheKey)
    const now = Date.now()
    
    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_DURATION && cachedEntry.accessToken === accessToken) {
      console.log('🚀 Returning cached inventory data (faster loading)')
      return NextResponse.json({
        success: true,
        products: cachedEntry.data.products,
        total: cachedEntry.data.total,
        cached: true,
        cacheAge: Math.round((now - cachedEntry.timestamp) / 1000)
      })
    }

    // First, get warehouse information to map warehouse_id to warehouse name
    const warehouseQuery = `
      query GetWarehouses {
        account {
          request_id
          complexity
          data {
            warehouses {
              id
              identifier
              address {
                name
              }
            }
          }
        }
      }
    `

    console.log('🏭 Fetching warehouse information first...')
    const warehouseResponse = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: warehouseQuery }),
    })

    const warehouseResult = await warehouseResponse.json()
    console.log('🏭 Warehouse data received:', {
      status: warehouseResponse.status,
      hasData: !!warehouseResult.data,
      warehouseCount: warehouseResult.data?.account?.data?.warehouses?.length || 0
    })

    // Create warehouse lookup map
    const warehouseMap = new Map()
    if (warehouseResult.data?.account?.data?.warehouses) {
      warehouseResult.data.account.data.warehouses.forEach((warehouse: any) => {
        warehouseMap.set(warehouse.id, {
          name: warehouse.address?.name || warehouse.identifier || 'Unknown Warehouse',
          identifier: warehouse.identifier
        })
      })
    }

    // GraphQL query to get all products with inventory information
    // Based on actual Product schema - using warehouse_products instead of inventory
    // Exclude kits and build kits as requested
    const query = `
      query GetInventory {
        products {
          request_id
          complexity
          data {
            edges {
              node {
                id
                sku
                name
                price
                barcode
                active
                kit
                kit_build
                warehouse_products {
                  warehouse_id
                  warehouse_identifier
                  on_hand
                  available
                  allocated
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `

    console.log('🚀 Making ShipHero GraphQL request:', {
      endpoint: 'https://public-api.shiphero.com/graphql',
      method: 'POST',
      hasToken: !!accessToken,
      queryLength: query.length,
      queryStart: query.substring(0, 100) + '...',
      noVariables: true
    })

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    })

    console.log('📡 ShipHero response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    })

    const result = await response.json()
    console.log('ShipHero inventory API response:', {
      status: response.status,
      hasData: !!result.data,
      hasErrors: !!result.errors,
      errors: result.errors,
      dataStructure: result.data ? Object.keys(result.data) : 'no data'
    })

    if (result.errors) {
      console.error('❌ ShipHero API returned errors:', {
        errorCount: result.errors.length,
        errors: result.errors,
        fullResponse: result
      })
      return NextResponse.json(
        { error: 'ShipHero API error', details: result.errors },
        { status: 400 }
      )
    }

    if (!response.ok) {
      console.error('❌ HTTP error from ShipHero:', {
        status: response.status,
        statusText: response.statusText,
        result: result
      })
      return NextResponse.json(
        { error: `ShipHero API HTTP error: ${response.status} ${response.statusText}`, details: result },
        { status: response.status }
      )
    }

    // Extract products and flatten the data structure
    // Filter out kits and build kits as requested
    const products = result.data?.products?.data?.edges
      ?.filter((edge: any) => {
        const node = edge.node
        // Exclude kits and build kits
        return !node.kit && !node.kit_build
      })
      ?.flatMap((edge: any) => {
        const warehouseProducts = edge.node.warehouse_products || []
        
        // If product has warehouse_products, create an entry for each warehouse
        if (warehouseProducts.length > 0) {
          return warehouseProducts.map((warehouseProduct: any) => {
            // Get warehouse name from our lookup map
            const warehouseInfo = warehouseProduct.warehouse_id ? 
              warehouseMap.get(warehouseProduct.warehouse_id) : null
            
            return {
              sku: edge.node.sku,
              name: edge.node.name,
              active: edge.node.active,
              price: edge.node.price,
              kit: edge.node.kit,
              kit_build: edge.node.kit_build,
              inventory: {
                available: warehouseProduct.available || 0,
                on_hand: warehouseProduct.on_hand || 0,
                allocated: warehouseProduct.allocated || 0,
                warehouse_id: warehouseProduct.warehouse_id,
                warehouse_identifier: warehouseProduct.warehouse_identifier,
                warehouse_name: warehouseInfo?.name || (warehouseProduct.warehouse_id ? 'Unknown Warehouse' : 'No Warehouse')
              }
            }
          })
        } else {
          // If no warehouse_products, show the product anyway with zero inventory
          return [{
            sku: edge.node.sku,
            name: edge.node.name,
            active: edge.node.active,
            price: edge.node.price,
            kit: edge.node.kit,
            kit_build: edge.node.kit_build,
            inventory: {
              available: 0,
              on_hand: 0,
              allocated: 0,
              warehouse_id: null,
              warehouse_identifier: null,
              warehouse_name: 'No Warehouse'
            }
          }]
        }
      }) || []

    const totalProductsBeforeFilter = result.data?.products?.data?.edges?.length || 0
    const kitsFiltered = totalProductsBeforeFilter - products.length
    
    console.log('✅ Successfully processed inventory data:', {
      totalProductsBeforeFilter,
      kitsFiltered,
      totalProducts: products.length,
      productsWithAvailableInventory: products.filter(p => p.inventory.available > 0).length,
      productsWithNoWarehouse: products.filter(p => !p.inventory.warehouse_id).length,
      productsWithZeroInventory: products.filter(p => p.inventory.on_hand === 0).length,
      sampleSKUs: products.slice(0, 5).map(p => p.sku),
      sampleWarehouses: products.slice(0, 5).map(p => p.inventory.warehouse_name)
    })

    // Cache the result for faster subsequent loads
    inventoryCache.set(cacheKey, {
      data: { products, total: products.length },
      timestamp: now,
      accessToken
    })

    // Clean up old cache entries (simple cleanup)
    for (const [key, entry] of inventoryCache.entries()) {
      if ((now - entry.timestamp) > CACHE_DURATION * 2) {
        inventoryCache.delete(key)
      }
    }

    return NextResponse.json({
      success: true,
      products,
      total: products.length,
      cached: false,
      cacheAge: 0
    })

  } catch (error: any) {
    console.error('Inventory API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error.message },
      { status: 500 }
    )
  }
}
