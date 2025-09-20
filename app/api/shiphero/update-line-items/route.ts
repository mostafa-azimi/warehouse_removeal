import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    const body = await request.json()
    const { order_id, line_items } = body

    console.log(`🔄 Updating line items for order ${order_id}:`, line_items.map((item: any) => `${item.id} -> qty: ${item.quantity}`))

    // Use the order_update_line_items mutation as specified in the documentation
    const query = `
      mutation {
        order_update_line_items(
          data: {
            order_id: "${order_id}"
            line_items: [
              ${line_items.map((item: any) => `{
                id: "${item.id}"
                quantity_pending_fulfillment: ${item.quantity}
              }`).join(',')}
            ]
          }
        ) {
          request_id
          complexity
          order {
            id
            order_number
            line_items(first: 20) {
              edges {
                node {
                  id
                  sku
                  quantity
                  quantity_pending_fulfillment
                  fulfillment_status
                }
              }
            }
          }
        }
      }
    `

    console.log('🔄 Executing order_update_line_items mutation...')

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    
    if (result.errors && result.errors.length > 0) {
      console.error('❌ GraphQL errors:', result.errors)
      return NextResponse.json({
        success: false,
        errors: result.errors,
        message: result.errors[0].message
      }, { status: 400 })
    }

    console.log('✅ Successfully updated line items')
    
    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Line items updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Update line items API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
