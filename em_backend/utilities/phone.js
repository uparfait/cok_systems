// Phone normalisation for MATCHING and de-duplication only.
// Never apply this to the signed attendance payload; the signed bytes keep the phone exactly as typed.
const RWANDA_COUNTRY_CODE = '250';

function canonicalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  // 07XXXXXXXX -> 2507XXXXXXXX
  if (digits.length === 10 && digits.startsWith('0')) return RWANDA_COUNTRY_CODE + digits.slice(1);
  // 7XXXXXXXX -> 2507XXXXXXXX
  if (digits.length === 9 && digits.startsWith('7')) return RWANDA_COUNTRY_CODE + digits;
  return digits;
}

// The raw spellings a user record might hold for one canonical number
function phoneVariants(value) {
  const canonical = canonicalPhone(value);
  if (!canonical) return [];
  const variants = new Set([canonical, `+${canonical}`]);
  if (canonical.startsWith(RWANDA_COUNTRY_CODE) && canonical.length === 12) {
    const local = canonical.slice(RWANDA_COUNTRY_CODE.length);
    variants.add(`0${local}`);
    variants.add(local);
    variants.add(`+${RWANDA_COUNTRY_CODE} ${local}`);
    variants.add(`+${RWANDA_COUNTRY_CODE} ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`);
    variants.add(`0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`);
  }
  return [...variants];
}

module.exports = { canonicalPhone, phoneVariants };
