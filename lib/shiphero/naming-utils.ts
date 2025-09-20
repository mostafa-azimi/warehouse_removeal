/**
 * Utility functions for generating ShipHero order names according to custom conventions
 */

/**
 * Generate sales order name: first letter first name, first three letters last name, date (mm/dd/yy), warehouse code, unique suffix
 * Example: mazi_9/2/25_ATL_A1B2
 * 
 * NOTE: ShipHero has a 32 character limit for order_number
 */
export function generateSalesOrderName(
  participantFirstName: string,
  participantLastName: string,
  warehouseName: string,
  airportCode?: string,
  date: Date = new Date()
): string {
  const firstLetter = participantFirstName.charAt(0).toUpperCase()
  const firstThreeLastName = participantLastName.substring(0, 3).toUpperCase()
  
  // Format date as mm/dd/yy
  const mm = date.getMonth() + 1
  const dd = date.getDate()
  const yy = date.getFullYear().toString().slice(-2)
  const dateStr = `${mm}/${dd}/${yy}`
  
  // Use airport code if available, otherwise use first 3 chars of warehouse name
  const warehouseCode = airportCode ? airportCode.toUpperCase().substring(0, 3) : 
    warehouseName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3)
  
  // Add unique suffix to avoid duplicates (4-digit random number)
  const uniqueSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  
  // Build order name ensuring it's under 32 characters
  const baseName = `${firstLetter}${firstThreeLastName}_${dateStr}_${warehouseCode}`
  const maxBaseLength = 31 - uniqueSuffix.length - 1 // -1 for underscore
  const truncatedBase = baseName.substring(0, maxBaseLength)
  
  return `${truncatedBase}_${uniqueSuffix}`
}

/**
 * Generate purchase order name: warehouse code, date (mm/dd/yy), host last name, unique suffix
 * Example: ATL_9/2/25_Azimi_A1B2
 * 
 * NOTE: ShipHero has a 32 character limit for po_number
 */
export function generatePurchaseOrderName(
  hostLastName: string,
  warehouseCode: string,
  date: Date = new Date()
): string {
  // Format date as mm/dd/yy
  const mm = date.getMonth() + 1
  const dd = date.getDate()
  const yy = date.getFullYear().toString().slice(-2)
  const dateStr = `${mm}/${dd}/${yy}`
  
  // Capitalize first letter of last name, rest lowercase
  const formattedLastName = hostLastName.charAt(0).toUpperCase() + hostLastName.slice(1).toLowerCase()
  
  // Use first 3 chars of warehouse code
  const shortWarehouseCode = warehouseCode.toUpperCase().substring(0, 3)
  
  // Add unique suffix to avoid duplicates (4-digit random number)
  const uniqueSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  
  // Build PO name ensuring it's under 32 characters
  const baseName = `${shortWarehouseCode}_${dateStr}_${formattedLastName}`
  const maxBaseLength = 31 - uniqueSuffix.length - 1 // -1 for underscore
  const truncatedBase = baseName.substring(0, maxBaseLength)
  
  return `${truncatedBase}_${uniqueSuffix}`
}

/**
 * Generate unique order number for sales orders
 * Format: SO-{timestamp}-{random}
 */
export function generateSalesOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SO-${timestamp}-${random}`
}

/**
 * Generate unique purchase order number
 * Format: PO-{timestamp}-{random}
 */
export function generatePurchaseOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PO-${timestamp}-${random}`
}