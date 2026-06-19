/**
 * Best-effort Open FDA pre-fill for a scanned barcode.
 *
 * Barcodes (UPC/EAN) do NOT reliably map to an FDA NDC code, so this is purely a
 * convenience: it tries a few searches against the public Open FDA drug APIs and
 * returns whatever maps. It NEVER throws and NEVER blocks the caller — on any
 * network error, timeout, or empty result it resolves to `null`, and the scan
 * flow proceeds with an empty form.
 */

export interface FdaPrefill {
  name?: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
}

const BASE = 'https://api.fda.gov/drug';
const TIMEOUT_MS = 4000;

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null; // 404 = no match; anything else = treat as miss
    return await res.json();
  } catch {
    return null; // network error / abort / parse error — never block
  } finally {
    clearTimeout(timer);
  }
}

/** Map an Open FDA NDC-directory record to our catalog fields. */
function fromNdcRecord(r: any): FdaPrefill {
  const ingredients: any[] = Array.isArray(r?.active_ingredients) ? r.active_ingredients : [];
  const strength = ingredients
    .map((i) => i?.strength)
    .filter(Boolean)
    .join(', ');
  return {
    name: r?.brand_name || r?.generic_name || undefined,
    dosageForm: r?.dosage_form || undefined,
    strength: strength || undefined,
    manufacturer: r?.labeler_name || r?.openfda?.manufacturer_name?.[0] || undefined,
  };
}

/**
 * Try to resolve catalog details for a scanned barcode. Returns `null` when
 * nothing usable is found.
 */
export async function lookupByBarcode(barcode: string): Promise<FdaPrefill | null> {
  const code = (barcode || '').trim();
  if (!code) return null;

  // A US drug's UPC sometimes embeds a 10-digit NDC (drop the leading "3" GS1
  // prefix + trailing check digit on a 12-digit UPC). We try both the raw code
  // and this derived NDC against the openfda.upc and product/package NDC fields.
  const derivedNdc = code.length === 12 ? code.slice(1, 11) : undefined;

  const searches = [
    `search=openfda.upc:"${encodeURIComponent(code)}"`,
    derivedNdc ? `search=product_ndc:"${encodeURIComponent(derivedNdc)}"` : undefined,
    derivedNdc ? `search=packaging.package_ndc:"${encodeURIComponent(derivedNdc)}"` : undefined,
  ].filter(Boolean) as string[];

  for (const q of searches) {
    const data = await fetchJson(`${BASE}/ndc.json?${q}&limit=1`);
    const record = data?.results?.[0];
    if (record) {
      const prefill = fromNdcRecord(record);
      if (Object.values(prefill).some(Boolean)) return prefill;
    }
  }

  return null;
}
