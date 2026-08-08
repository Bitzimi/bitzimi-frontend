/**
 * Supported countries with phone codes, flags, and digit length hints.
 */

export interface Country {
  code: string;
  name: string;
  phoneCode: string;
  flag: string;
  /** Expected digit count for the subscriber number (after country code) */
  digits?: number;
  /** Placeholder format for the subscriber number */
  placeholder?: string;
}

export const SUPPORTED_COUNTRIES: Country[] = [
  { code: "AR", name: "Argentina",      phoneCode: "+54",  flag: "🇦🇷", digits: 10, placeholder: "1123456789" },
  { code: "AU", name: "Australia",      phoneCode: "+61",  flag: "🇦🇺", digits: 9,  placeholder: "412345678" },
  { code: "BR", name: "Brazil",         phoneCode: "+55",  flag: "🇧🇷", digits: 11, placeholder: "11912345678" },
  { code: "CA", name: "Canada",         phoneCode: "+1",   flag: "🇨🇦", digits: 10, placeholder: "6135550100" },
  { code: "CN", name: "China",          phoneCode: "+86",  flag: "🇨🇳", digits: 11, placeholder: "13123456789" },
  { code: "EG", name: "Egypt",          phoneCode: "+20",  flag: "🇪🇬", digits: 10, placeholder: "1012345678" },
  { code: "FR", name: "France",         phoneCode: "+33",  flag: "🇫🇷", digits: 9,  placeholder: "612345678" },
  { code: "DE", name: "Germany",        phoneCode: "+49",  flag: "🇩🇪", digits: 10, placeholder: "1512345678" },
  { code: "GH", name: "Ghana",          phoneCode: "+233", flag: "🇬🇭", digits: 9,  placeholder: "241234567" },
  { code: "IN", name: "India",          phoneCode: "+91",  flag: "🇮🇳", digits: 10, placeholder: "9123456789" },
  { code: "ID", name: "Indonesia",      phoneCode: "+62",  flag: "🇮🇩", digits: 10, placeholder: "8123456789" },
  { code: "IT", name: "Italy",          phoneCode: "+39",  flag: "🇮🇹", digits: 10, placeholder: "3121234567" },
  { code: "JP", name: "Japan",          phoneCode: "+81",  flag: "🇯🇵", digits: 10, placeholder: "9012345678" },
  { code: "KE", name: "Kenya",          phoneCode: "+254", flag: "🇰🇪", digits: 9,  placeholder: "712345678" },
  { code: "MX", name: "Mexico",         phoneCode: "+52",  flag: "🇲🇽", digits: 10, placeholder: "5512345678" },
  { code: "NZ", name: "New Zealand",    phoneCode: "+64",  flag: "🇳🇿", digits: 9,  placeholder: "212345678" },
  { code: "NG", name: "Nigeria",        phoneCode: "+234", flag: "🇳🇬", digits: 10, placeholder: "8123456789" },
  { code: "PH", name: "Philippines",    phoneCode: "+63",  flag: "🇵🇭", digits: 10, placeholder: "9171234567" },
  { code: "RU", name: "Russia",         phoneCode: "+7",   flag: "🇷🇺", digits: 10, placeholder: "9161234567" },
  { code: "SG", name: "Singapore",      phoneCode: "+65",  flag: "🇸🇬", digits: 8,  placeholder: "91234567" },
  { code: "ZA", name: "South Africa",   phoneCode: "+27",  flag: "🇿🇦", digits: 9,  placeholder: "712345678" },
  { code: "KR", name: "South Korea",    phoneCode: "+82",  flag: "🇰🇷", digits: 10, placeholder: "1012345678" },
  { code: "GB", name: "United Kingdom", phoneCode: "+44",  flag: "🇬🇧", digits: 10, placeholder: "7123456789" },
  { code: "US", name: "United States",  phoneCode: "+1",   flag: "🇺🇸", digits: 10, placeholder: "2025550100" },
];

/** Get country by ISO code */
export function getCountryByCode(code: string): Country | undefined {
  return SUPPORTED_COUNTRIES.find(c => c.code === code);
}

/** Get country by phone code */
export function getCountryByPhoneCode(phoneCode: string): Country | undefined {
  return SUPPORTED_COUNTRIES.find(c => c.phoneCode === phoneCode);
}
