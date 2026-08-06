// Get rounded bet amounts based on currency and lobby range
export function getRoundedBetAmounts(
  currencyCode: string,
  minBet: number,
  maxBet: number
): number[] {
  // Currency-specific rounded amounts
  const currencyPresets: Record<string, number[]> = {
    // USD - clean dollar amounts
    USD: [1, 5, 10, 20, 50, 100, 500],
    
    // EUR - clean euro amounts
    EUR: [1, 5, 10, 20, 50, 100, 500],
    
    // GBP - clean pound amounts
    GBP: [1, 5, 10, 20, 50, 100, 500],
    
    // NGN - Nigerian Naira (higher denominations)
    NGN: [500, 1000, 5000, 10000, 20000, 50000, 100000],
    
    // ZAR - South African Rand
    ZAR: [10, 50, 100, 500, 1000, 5000, 10000],
    
    // KES - Kenyan Shilling
    KES: [100, 500, 1000, 5000, 10000, 50000, 100000],
    
    // CNY - Chinese Yuan
    CNY: [10, 50, 100, 500, 1000, 5000, 10000],
    
    // INR - Indian Rupee
    INR: [50, 100, 500, 1000, 5000, 10000, 50000],
  };

  // Get preset amounts for this currency
  const presets = currencyPresets[currencyCode] || currencyPresets.USD;
  
  // Filter presets to fit within the lobby's min/max range
  const validPresets = presets.filter(amount => amount >= minBet && amount <= maxBet);
  
  // If we have valid presets, return the first 4
  if (validPresets.length >= 4) {
    return validPresets.slice(0, 4);
  }
  
  // If not enough presets, generate rounded amounts within range
  const range = maxBet - minBet;
  const step = range / 3;
  
  // Generate amounts and round based on currency
  const amounts = [
    minBet,
    minBet + step,
    minBet + step * 2,
    maxBet
  ];
  
  // Round to appropriate level based on currency
  return amounts.map(amount => roundToCurrency(amount, currencyCode));
}

// Round amount to culturally appropriate level for currency
function roundToCurrency(amount: number, currencyCode: string): number {
  switch (currencyCode) {
    case 'NGN':
    case 'KES':
      // Round to nearest 100
      return Math.round(amount / 100) * 100;
    
    case 'INR':
    case 'CNY':
    case 'ZAR':
      // Round to nearest 10
      return Math.round(amount / 10) * 10;
    
    case 'USD':
    case 'EUR':
    case 'GBP':
    default:
      // Round to whole number
      return Math.round(amount);
  }
}

// Format bet amount for display (no decimals)
export function formatBetAmount(amount: number, currencySymbol: string, currencyCode: string): string {
  const rounded = roundToCurrency(amount, currencyCode);
  
  // Format with thousands separator, no decimals
  return `${currencySymbol}${rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
