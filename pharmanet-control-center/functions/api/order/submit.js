import { PharmaNetClient } from '../../../src/pharmanetClient.js';
import { saveLearnedMapping } from '../../../src/learnedMappings.js';
import { allocateBatchesFefo } from '../../../src/fefoAllocator.js';
import { DEFAULT_PLANT, ORDER_DESIGNATION_OTHER, NORMAL_ORDER_TEMPLATE_VALUE } from '../../../src/constants.js';
import { checkAppPin, pinRequiredResponse } from '../_auth.js';
import { json } from '../_responses.js';

/**
 * Creates a real PharmaNET order from already-confirmed lines, routing each
 * one to whichever system its matched product came from: Normal Order
 * ("Sales Order", no rate-entry authority) or Generic Order (division-
 * specific "Combo" materials, frmGenericOrder.aspx). Rate/qty are re-fetched
 * live from PharmaNET right before saving in both cases, exactly like each
 * page's own "Add" button does — nothing from /order/prepare is trusted.
 */
export async function onRequestPost({ request, env }) {
  if (!checkAppPin(request, env)) return pinRequiredResponse();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const {
    userId,
    password,
    plant = DEFAULT_PLANT,
    custNo,
    customerName,
    orderMode,
    billToAddr,
    shipToAddr,
    designation,
    empOther,
    remark = '',
    customerOrderNo = '',
    lines,
  } = payload || {};

  if (!userId || !password) return json({ error: 'PharmaNET User ID and Password are required.' }, 400);
  if (!custNo || !customerName) return json({ error: 'custNo and customerName are required.' }, 400);
  if (!orderMode || !billToAddr || !shipToAddr) return json({ error: 'orderMode, billToAddr and shipToAddr are required.' }, 400);
  if (!designation) return json({ error: 'designation is required.' }, 400);
  if (!Array.isArray(lines) || lines.length === 0) return json({ error: 'No order lines were supplied.' }, 400);
  const unresolved = lines.filter((l) => !l.product || !l.product.code);
  if (unresolved.length > 0) {
    return json({ error: `${unresolved.length} line(s) have no confirmed product. Resolve every line before submitting.` }, 400);
  }

  const normalLines = lines.filter((l) => l.product.system !== 'GENERIC');
  const genericLines = lines.filter((l) => l.product.system === 'GENERIC');

  const client = new PharmaNetClient();
  try {
    await client.login(userId, password);

    let empNo = '0';
    if (designation !== ORDER_DESIGNATION_OTHER) {
      const emp = await client.getEmployeeForDesignation({ plant, custNo, designationNo: designation });
      if (!emp) return json({ error: `No employee found for designation ${designation} on customer ${custNo}.` }, 400);
      empNo = String(emp.EmpNo);
    }

    const orderedLines = [];
    let message = '';

    if (normalLines.length > 0) {
      const result = await submitNormalLines({ client, plant, custNo, customerName, orderMode, billToAddr, shipToAddr, customerOrderNo, empNo, empOther, remark, lines: normalLines, env });
      orderedLines.push(...result.orderedLines);
      message += result.message;
    }

    if (genericLines.length > 0) {
      const result = await submitGenericLines({ client, plant, custNo, orderMode, billToAddr, shipToAddr, designation, customerOrderNo, empNo, empOther, remark, lines: genericLines, env });
      orderedLines.push(...result.orderedLines);
      message += (message ? ' | ' : '') + result.message;
    }

    return json({ ok: true, message, orderedLines });
  } catch (err) {
    console.error('order/submit failed:', err.message);
    return json({ error: 'Failed to submit order. ' + err.message }, 500);
  }
}

async function submitNormalLines({ client, plant, custNo, customerName, orderMode, billToAddr, shipToAddr, customerOrderNo, empNo, empOther, remark, lines, env }) {
  await client.openNormalOrderPage();
  const pharmaDate = await client.getPharmaDate(plant);
  const cashDiscount = await client.getCashDiscount(custNo, plant);

  const builtLines = [];
  for (const line of lines) {
    const { product } = line;
    const qtyInfo = await client.getQtyMultiFactor({
      plant,
      custNo,
      divisionNo: product.divisionNo,
      materialNo: product.code,
      orderDate: pharmaDate,
      qty: line.qty,
    });
    const finalQty =
      qtyInfo && String(qtyInfo.cConsiderQuantityMultiFactor).trim() === 'Y'
        ? Math.round(line.qty / product.qtyMultiFactor) * product.qtyMultiFactor
        : line.qty;
    if (finalQty <= 0) throw new Error(`${product.name}: resolved quantity must be greater than 0.`);

    const rate = await client.getMaterialRate(product.code, finalQty, plant);
    if (rate == null) throw new Error(`${product.name}: PharmaNET did not return a rate.`);

    builtLines.push({
      divisionNo: product.divisionNo,
      divisionName: product.divisionName,
      materialName: product.materialNameFull,
      materialNo: product.code,
      qty: finalQty,
      matFlag: product.matFlag,
      taxOrExm: product.taxOrExm,
      rate: rate.toFixed(2),
      value: (finalQty * rate).toFixed(2),
    });

    if (line.normalizedKey) await saveLearnedMapping(env.LEARNED_MAPPINGS, line.normalizedKey, product.code);
  }

  const message = await client.createSalesOrder({
    customerName,
    customerNo: custNo,
    plant,
    orderDate: pharmaDate,
    customerOrderDate: pharmaDate,
    dispatchedDate: pharmaDate,
    remark,
    orderMode,
    customerOrderNo,
    billToAddr,
    shipToAddr,
    discount: cashDiscount,
    chequeBookId: '0',
    instrumentNo: '',
    empNo,
    empOther: empOther || '',
    templateValue: NORMAL_ORDER_TEMPLATE_VALUE,
    lines: builtLines,
  });

  return { message, orderedLines: builtLines };
}

/**
 * Generic Order ("Combo" materials) groups by material: every line for the
 * same material is split FEFO across its live batches, then re-priced once
 * as a single blended rate for their combined qty — exactly like the page's
 * own "Add" button does when the same material is added more than once.
 */
async function submitGenericLines({ client, plant, custNo, orderMode, billToAddr, shipToAddr, designation, customerOrderNo, empNo, empOther, remark, lines, env }) {
  const customerState = await client.selectGenericCustomer({ hiddenFields: await client.openGenericOrderPage(), plant, custNo });

  const byMaterial = new Map();
  for (const line of lines) {
    const code = line.product.code;
    if (!byMaterial.has(code)) byMaterial.set(code, { product: line.product, qty: 0, normalizedKeys: [] });
    const entry = byMaterial.get(code);
    entry.qty += line.qty;
    if (line.normalizedKey) entry.normalizedKeys.push(line.normalizedKey);
  }

  const cartRows = [];
  const orderedLines = [];
  let latestHiddenFields = customerState.hiddenFields;

  for (const [materialNo, entry] of byMaterial) {
    const materialState = await client.selectGenericMaterial({ hiddenFields: customerState.hiddenFields, plant, custNo, materialNo });
    latestHiddenFields = materialState.hiddenFields;

    const allocations = allocateBatchesFefo(materialState.batches, entry.qty, materialState.packSize);
    const rate = await client.getMaterialRate(materialNo, entry.qty, plant);
    if (rate == null) throw new Error(`${entry.product.name}: PharmaNET did not return a rate.`);

    for (const alloc of allocations) {
      cartRows.push({
        plant,
        custNo,
        divisionNo: materialState.divisionNo,
        orderMode,
        customerOrderNo,
        docType: materialState.docType,
        billToAddr,
        institution: '0',
        materialNo,
        qty: alloc.qty,
        materialName: materialState.materialName,
        rate: rate.toFixed(2),
        matFlag: entry.product.matFlag,
        taxClass: materialState.taxClass,
        batch: alloc.batch,
        empNo,
        empOther: empOther || '',
      });
      orderedLines.push({
        materialName: entry.product.name,
        materialNo,
        batch: alloc.batch,
        qty: alloc.qty,
        rate: rate.toFixed(2),
        value: (alloc.qty * rate).toFixed(2),
      });
    }

    for (const key of entry.normalizedKeys) await saveLearnedMapping(env.LEARNED_MAPPINGS, key, materialNo);
  }

  const message = await client.createGenericOrder({
    hiddenFields: latestHiddenFields,
    plant,
    custNo,
    billToAddr,
    shipToAddr,
    institution: '0',
    designation,
    orderMode,
    customerOrderNo,
    empNo,
    empOther: empOther || '',
    remark,
    lines: cartRows,
  });

  return { message, orderedLines };
}
