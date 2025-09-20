import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    console.log('ShipHero Orders API - Request:', {
      type,
      data: JSON.stringify(data, null, 2)
    })

    // Validate required fields for sales order
    if (type === 'sales_order') {
      const requiredFields = ['order_number', 'shop_name', 'shipping_lines', 'shipping_address', 'billing_address', 'line_items']
      for (const field of requiredFields) {
        if (!data[field]) {
          console.error(`❌ Missing required field: ${field}`)
          return NextResponse.json(
            { error: `Missing required field: ${field}`, details: `Field '${field}' is required for sales orders` },
            { status: 400 }
          )
        }
      }
      
      // Validate shipping_lines structure
      if (!data.shipping_lines.title) {
        console.error(`❌ Missing shipping_lines.title`)
        console.error(`❌ shipping_lines data:`, data.shipping_lines)
        return NextResponse.json(
          { error: 'Missing shipping_lines.title', details: 'shipping_lines must have a title field' },
          { status: 400 }
        )
      }
    }

    let query: string
    let variables: any

    if (type === 'sales_order') {
      query = `
        mutation {
          order_create(
            data: {
              order_number: "${data.order_number}"
              shop_name: "${data.shop_name}"
              fulfillment_status: "${data.fulfillment_status}"
              order_date: "${data.order_date}"
              total_tax: "${data.total_tax}"
              subtotal: "${data.subtotal}"
              total_discounts: "${data.total_discounts}"
              total_price: "${data.total_price}"
              shipping_lines: {
                title: "${data.shipping_lines.title}"
                price: "${data.shipping_lines.price}"
                carrier: "${data.shipping_lines.carrier}"
                method: "${data.shipping_lines.method}"
              }
              shipping_address: {
                first_name: "${data.shipping_address.first_name}"
                last_name: "${data.shipping_address.last_name}"
                company: "${data.shipping_address.company}"
                address1: "${data.shipping_address.address1}"
                address2: "${data.shipping_address.address2}"
                city: "${data.shipping_address.city}"
                state: "${data.shipping_address.state}"
                state_code: "${data.shipping_address.state_code}"
                zip: "${data.shipping_address.zip}"
                country: "${data.shipping_address.country}"
                country_code: "${data.shipping_address.country_code}"
                email: "${data.shipping_address.email}"
                phone: "${data.shipping_address.phone}"
              }
              billing_address: {
                first_name: "${data.billing_address.first_name}"
                last_name: "${data.billing_address.last_name}"
                company: "${data.billing_address.company}"
                address1: "${data.billing_address.address1}"
                address2: "${data.billing_address.address2}"
                city: "${data.billing_address.city}"
                state: "${data.billing_address.state}"
                state_code: "${data.billing_address.state_code}"
                zip: "${data.billing_address.zip}"
                country: "${data.billing_address.country}"
                country_code: "${data.billing_address.country_code}"
                email: "${data.billing_address.email}"
                phone: "${data.billing_address.phone}"
              }
              line_items: [
                ${data.line_items.map((item: any) => `{
                  sku: "${item.sku}"
                  partner_line_item_id: "${item.partner_line_item_id}"
                  quantity: ${Number(item.quantity) || 1}
                  price: "${item.price}"
                  product_name: "${item.product_name}"
                  fulfillment_status: "${item.fulfillment_status}"
                  quantity_pending_fulfillment: ${Number(item.quantity_pending_fulfillment) || 1}
                  warehouse_id: "${item.warehouse_id}"
                }`).join(',')}
              ]
              required_ship_date: "${data.required_ship_date}"
              ${data.hold_until_date ? `hold_until_date: "${data.hold_until_date}"` : ''}
              tags: [${data.tags ? data.tags.map((tag: string) => `"${tag}"`).join(',') : ''}]
            }
          ) {
            request_id
            complexity
            order {
              id
              legacy_id
              order_number
              shop_name
              email
              total_price
              fulfillment_status
              order_date
              tags
            }
          }
        }
      `
      variables = {}
    } else if (type === 'purchase_order') {
      query = `
        mutation {
          purchase_order_create(
            data: {
              po_date: "${data.po_date}"
              po_number: "${data.po_number}"
              subtotal: "${data.subtotal}"
              tax: "${data.tax || '0.00'}"
              shipping_price: "${data.shipping_price}"
              total_price: "${data.total_price}"
              warehouse_id: "${data.warehouse_id}"
              fulfillment_status: "${data.fulfillment_status}"
              discount: "${data.discount}"
              vendor_id: "${data.vendor_id}"
              line_items: [
                ${data.line_items.map((item: any) => `{
                  sku: "${item.sku}"
                  quantity: ${Number(item.quantity) || 1}
                  expected_weight_in_lbs: "${item.expected_weight_in_lbs}"
                  vendor_id: "${item.vendor_id}"
                  quantity_received: ${Number(item.quantity_received) || 0}
                  quantity_rejected: ${Number(item.quantity_rejected) || 0}
                  price: "${item.price}"
                  product_name: "${item.product_name}"
                  fulfillment_status: "${item.fulfillment_status}"
                  sell_ahead: ${Number(item.sell_ahead) || 0}
                }`).join(',')}
              ]
            }
          ) {
            request_id
            complexity
            purchase_order {
              id
              legacy_id
              po_number
              warehouse_id
              subtotal
              total_price
              fulfillment_status
              po_date
            }
          }
        }
      `
      variables = {}
    } else {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 })
    }

    console.log('ShipHero Orders API - GraphQL Query:', query)
    console.log('ShipHero Orders API - Variables:', JSON.stringify(variables, null, 2))

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ query, variables })
    })

    console.log('ShipHero Orders API - Response Status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('ShipHero Orders API - Error Response:', errorText)
      console.log('ShipHero Orders API - Request Body:', JSON.stringify({ query, variables }, null, 2))
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('ShipHero Orders API - Success Response:', JSON.stringify(result, null, 2))
    
    // Check for GraphQL errors in successful response
    if (result.errors && result.errors.length > 0) {
      console.log('ShipHero GraphQL Errors:', JSON.stringify(result.errors, null, 2))
      console.log('ShipHero Orders API - Request Body:', JSON.stringify({ query, variables }, null, 2))
    }
    
    // Add request details to the response for UI display
    const responseWithRequest = {
      ...result,
      _request: {
        query,
        variables,
        originalData: data,
        type
      }
    }
    
    return NextResponse.json(responseWithRequest)

  } catch (error: any) {
    console.error('ShipHero orders API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
