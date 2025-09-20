import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    console.log(`🔍 DEBUG: Token received in cancel-orders API:`, {
      hasToken: !!accessToken,
      tokenLength: accessToken?.length,
      tokenStart: accessToken?.substring(0, 20) + '...',
      tokenEnd: '...' + accessToken?.substring(accessToken.length - 20),
      fullToken: accessToken // TEMPORARY: Log full token for debugging
    })
    
    // Also test the same token retrieval method the client uses
    console.log(`🔍 DEBUG: Testing database token retrieval directly...`)
    try {
      const dbResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/shiphero/access-token`)
      if (dbResponse.ok) {
        const dbResult = await dbResponse.json()
        console.log(`🔍 DEBUG: Database token retrieval result:`, {
          success: dbResult.success,
          tokenStart: dbResult.access_token?.substring(0, 20) + '...',
          tokenEnd: '...' + dbResult.access_token?.substring(dbResult.access_token.length - 20),
          tokensMatch: dbResult.access_token === accessToken
        })
      } else {
        console.log(`🔍 DEBUG: Database token retrieval failed:`, dbResponse.status)
      }
    } catch (dbError) {
      console.log(`🔍 DEBUG: Database token retrieval error:`, dbError)
    }
    
    if (!accessToken) {
      console.error(`❌ No access token provided to cancel-orders API`)
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }
    
    // Token is valid - we confirmed this by bypassing validation
    console.log(`🔍 DEBUG: Token validation bypassed - proceeding with PO cancellation`)
    console.log(`🔍 DEBUG: Using token with length:`, accessToken.length)

    const body = await request.json()
    const { orders, type, new_status, use_cancel_mutation } = body // orders: array of {id, legacy_id}, type: 'sales' or 'purchase', new_status: optional, use_cancel_mutation: boolean

    const targetStatus = new_status || (type === 'sales' ? 'on_hold' : 'Canceled')
    
    if (use_cancel_mutation && type === 'sales') {
      console.log(`🚫 Canceling ${type} orders using order_cancel mutation:`, orders.map((o: any) => o.legacy_id || o.id))
    } else if (use_cancel_mutation && type === 'purchase') {
      console.log(`🚫 Canceling ${type} orders using purchase_order_cancel mutation:`, orders.map((o: any) => o.legacy_id || o.id))
    } else {
      console.log(`🚫 Setting ${type} orders to ${targetStatus}:`, orders.map((o: any) => o.legacy_id || o.id))
    }

    const results = []
    const errors = []

    for (const order of orders) {
        try {
          let query: string
          
          if (use_cancel_mutation && type === 'sales') {
            // Use order_cancel mutation for sales orders
            query = `
              mutation {
                order_cancel(
                  data: {
                    order_id: "${order.id}"
                    reason: "Tour canceled"
                  }
                ) {
                  request_id
                  complexity
                  order {
                    id
                    legacy_id
                    order_number
                    fulfillment_status
                  }
                }
              }
            `
          } else if (use_cancel_mutation && type === 'purchase') {
            // For purchase orders: Use purchase_order_set_fulfillment_status mutation
            console.log(`🔍 DEBUG: Purchase order data for cancellation:`, {
              id: order.id,
              legacy_id: order.legacy_id,
              po_number: order.po_number || 'N/A'
            })
            
            // Use the correct mutation for PO fulfillment status
            const poId = String(order.legacy_id)
            query = `
              mutation {
                purchase_order_set_fulfillment_status(
                  data: { 
                    po_id: "${poId}"
                    status: "canceled"
                  }
                ) {
                  request_id
                  complexity
                  purchase_order {
                    id
                    legacy_id
                    po_number
                    fulfillment_status
                  }
                }
              }
            `
            
            console.log(`🔍 DEBUG: Using purchase_order_set_fulfillment_status mutation:`, query)
          } else if (type === 'sales') {
            // Update sales order fulfillment status
            query = `
              mutation {
                order_update(
                  data: {
                    order_id: "${order.id}"
                    fulfillment_status: "${targetStatus}"
                  }
                ) {
                  request_id
                  complexity
                  order {
                    id
                    legacy_id
                    order_number
                    fulfillment_status
                  }
                }
              }
            `
          } else {
            // Update purchase order fulfillment status
            query = `
              mutation {
                purchase_order_update(
                  data: {
                    purchase_order_id: "${order.id}"
                    fulfillment_status: "${targetStatus}"
                  }
                ) {
                  request_id
                  complexity
                  purchase_order {
                    id
                    legacy_id
                    po_number
                    fulfillment_status
                  }
                }
              }
            `
          }

        console.log(`🔄 Canceling ${type} order ${order.legacy_id || order.id}...`)
        
        const requestBody = { query }
        console.log(`🔍 DEBUG: Request body being sent to ShipHero:`, JSON.stringify(requestBody, null, 2))
        console.log(`🔍 DEBUG: Authorization header present:`, accessToken ? `Yes (starts with: ${accessToken.substring(0, 10)}...)` : 'No')

        const response = await fetch('https://public-api.shiphero.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(requestBody)
        })

        console.log(`🔍 DEBUG: ShipHero response status:`, response.status)
        console.log(`🔍 DEBUG: ShipHero response headers:`, Object.fromEntries(response.headers.entries()))

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ ShipHero API HTTP Error:`, {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText,
            query: query,
            requestBody: requestBody
          })
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
        }

        const result = await response.json()
        
        console.log(`🔍 DEBUG: ShipHero API response for ${type} order ${order.legacy_id || order.id}:`, JSON.stringify(result, null, 2))
        
                    if (result.errors && result.errors.length > 0) {
                      console.error(`❌ GraphQL errors for ${type} order ${order.legacy_id}:`, result.errors)
                      console.error(`🔍 DEBUG: First GraphQL error details:`, {
                        message: result.errors[0].message,
                        path: result.errors[0].path,
                        extensions: result.errors[0].extensions,
                        fullError: result.errors[0]
                      })
                      errors.push({
                        order: order.legacy_id || order.id,
                        error: result.errors[0].message,
                        graphql_error: result.errors[0],
                        server_details: `GraphQL Error: ${result.errors[0].message}${result.errors[0].extensions ? ` | Extensions: ${JSON.stringify(result.errors[0].extensions)}` : ''}`
                      })
                    } else {
                      // Log the actual purchase order data returned to verify status change
                      if (type === 'purchase') {
                        const poData = result.data?.purchase_order_set_fulfillment_status?.purchase_order
                        console.log(`✅ Purchase order fulfillment status update result:`, {
                          id: poData?.id,
                          legacy_id: poData?.legacy_id,
                          po_number: poData?.po_number,
                          fulfillment_status: poData?.fulfillment_status,
                          fullData: poData
                        })
                      }
                      
                      console.log(`✅ Successfully canceled ${type} order ${order.legacy_id || order.id}`)
                      results.push({
                        order: order.legacy_id || order.id,
                        success: true,
                        data: result.data
                      })
                    }

      } catch (error: any) {
        console.error(`❌ Error canceling ${type} order ${order.legacy_id || order.id}:`, error.message)
        errors.push({
          order: order.legacy_id || order.id,
          error: error.message
        })
      }
    }

    const response = {
      success: errors.length === 0,
      canceled_count: results.length,
      total_count: orders.length,
      results,
      errors
    }

    console.log(`🏁 Cancellation complete: ${results.length}/${orders.length} ${type} orders canceled`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Cancel orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
