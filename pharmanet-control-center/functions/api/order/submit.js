import { PharmaNetClient } from '../../../src/pharmanetClient.js';
import { saveLearnedMapping } from '../../../src/learnedMappings.js';
import { DEFAULT_PLANT, ORDER_DESIGNATION_OTHER, NORMAL_ORDER_TEMPLATE_VALUE } from '../../../src/constants.js';
import { checkAppPin, pinRequiredResponse } from '../_auth.js';
import { json } from '../_responses.js';

/**
 * Creates a real PharmaNET Normal Order ("Sales Order"). Every line must
 * already carry an admin-confirmed `product` (no rate entry happens here —
 * rate/qty are re-fetched live from PharmaNET right before saving, exactly
 * like the "Add" button does on frmNormalRateOrder.aspx).
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

  const client = new PharmaNetClient();
  try {
    await client.login(userId, password);
    await client.openNormalOrderPage();

    const pharmaDate = await client.getPharmaDate(plant);
    const cashDiscount = await client.getCashDiscount(custNo, plant);

    let empNo = '0';
    if (designation !== ORDER_DESIGNATION_OTHER) {
      const emp = await client.getEmployeeForDesignation({ plant, custNo, designationNo: designation });
      if (!emp) return json({ error: `No employee found for designation ${designation} on customer ${custNo}.` }, 400);
      empNo = String(emp.EmpNo);
    }

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
      if (finalQty <= 0) return json({ error: `${product.name}: resolved quantity must be greater than 0.` }, 400);

      const rate = await client.getMaterialRate(product.code, finalQty, plant);
      if (rate == null) return json({ error: `${product.name}: PharmaNET did not return a rate.` }, 400);

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

    return json({ ok: true, message, orderedLines: builtLines });
  } catch (err) {
    console.error('order/submit failed:', err.message);
    return json({ error: 'Failed to submit order. ' + err.message }, 500);
  }
}
