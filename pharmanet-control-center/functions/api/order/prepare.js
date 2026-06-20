import { PharmaNetClient } from '../../../src/pharmanetClient.js';
import { matchOrderLines } from '../../../src/productMatcher.js';
import { loadLearnedMappings } from '../../../src/learnedMappings.js';
import { ORDER_DESIGNATIONS, DEFAULT_PLANT } from '../../../src/constants.js';
import { checkAppPin, pinRequiredResponse } from '../_auth.js';
import { json } from '../_responses.js';

/**
 * Logs in, fetches the customer's live material list from PharmaNET, and
 * matches the party's order-file lines against it (learned mappings first,
 * then exact/fuzzy text, then candidates for manual review). No PharmaNET
 * write happens here — this is purely the review step before /order/submit.
 */
export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const { userId, password, plant = DEFAULT_PLANT, custNo, lines } = payload || {};
  if (!userId || !password) return json({ error: 'PharmaNET User ID and Password are required.' }, 400);
  if (!custNo) return json({ error: 'custNo is required.' }, 400);
  if (!Array.isArray(lines) || lines.length === 0) return json({ error: 'No order lines were supplied.' }, 400);

  const client = new PharmaNetClient();
  try {
    await client.login(userId, password);
    await client.openNormalOrderPage();

    const customers = await client.getCustomersForNormalOrder(plant);
    const customer = customers.find((c) => String(c.nCustSupNo) === String(custNo));
    if (!customer) return json({ error: `Customer ${custNo} was not found for plant ${plant}.` }, 404);

    const materials = await client.getMaterialsForCustomer(custNo, plant);
    const normalProducts = materials.map((m) => ({
      code: String(m.nMaterialNo),
      name: m.vMaterialNameExcel,
      divisionNo: m.ndivisionno,
      divisionName: m.vdivisionname,
      matFlag: m.cDomesticExportFlag,
      taxOrExm: m.nMaterialTaxClassNo,
      qtyMultiFactor: Number(m.iQtyMultiFactor) || 1,
      availableQty: Number(m.AvailableQty) || 0,
      materialNameFull: m.MaterialName,
      system: 'NORMAL',
    }));

    // Generic Order ("Combo"/division-specific materials) is a separate
    // catalog from Normal Order's — frmGenericOrder.aspx has no JSON
    // webmethod for it, so its material list only exists as the dropdown
    // options returned by the customer-select postback.
    const genericState = await client.selectGenericCustomer({ hiddenFields: await client.openGenericOrderPage(), plant, custNo });
    const genericProducts = genericState.materials.map((m) => ({
      code: m.code,
      name: m.name,
      sapCode: m.sapCode,
      matFlag: m.matFlag,
      availableQty: m.availableQty,
      system: 'GENERIC',
    }));

    const productMaster = [...normalProducts, ...genericProducts];
    const learned = await loadLearnedMappings(env.LEARNED_MAPPINGS);
    const matched = matchOrderLines(lines, productMaster, learned);

    // For lines auto-confirmed against a Generic Order material, resolve its
    // batch list now so the review UI can show a FEFO (earliest-expiry-first)
    // preview before the operator confirms. Final batch split is recomputed
    // fresh at submit time against whatever qty/state holds then.
    for (const m of matched) {
      if (m.status !== 'AUTO_CONFIRMED' || m.product.system !== 'GENERIC') continue;
      const materialState = await client.selectGenericMaterial({
        hiddenFields: genericState.hiddenFields,
        plant,
        custNo,
        materialNo: m.product.code,
      });
      m.product.batches = materialState.batches;
      m.product.packSize = materialState.packSize;
    }

    const [pharmaDate, orderModes, addresses, cashDiscount] = await Promise.all([
      client.getPharmaDate(plant),
      client.getOrderModes(),
      client.getBillShipAddresses(custNo),
      client.getCashDiscount(custNo, plant),
    ]);

    return json({
      customer: { custNo: String(customer.nCustSupNo), name: customer.vCustSupName.trim() },
      pharmaDate,
      orderModes: orderModes.map((m) => ({ value: String(m.nOrderModeNo), label: m.vOrderMode })),
      addresses: {
        billTo: addresses.billTo.map((a) => ({ value: String(a.nAddressNo), label: a.vAddress1 })),
        shipTo: addresses.shipTo.map((a) => ({ value: String(a.nAddressNo), label: a.vAddress1 })),
      },
      cashDiscount,
      designations: ORDER_DESIGNATIONS,
      lines: matched,
      // Sent so the review UI can offer a manual search fallback when none of
      // a NEEDS_REVIEW line's auto-suggested candidates are the right product.
      productMaster,
    });
  } catch (err) {
    console.error('order/prepare failed:', err.message);
    return json({ error: 'Failed to prepare order. ' + err.message }, 500);
  }
}
