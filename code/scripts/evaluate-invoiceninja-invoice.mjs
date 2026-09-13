#!/usr/bin/env node
// Independent Invoice Ninja invoice oracle (CLI).
//
// Authority is the persisted application database. The visible page and the
// arm's self-reported verdict are never treated as ground truth.
import { evaluateInvoiceNinjaInvoice, INVOICENINJA_DEFAULT_EXPECTED, INVOICENINJA_DEFAULT_INVOICE_NUMBER } from '../src/invoiceninja-oracle.mjs';

const invoiceNumber = process.env.PSS_INVOICENINJA_INVOICE_NUMBER ?? INVOICENINJA_DEFAULT_INVOICE_NUMBER;
const expected = {
  status_id: Number(process.env.PSS_INVOICENINJA_EXPECTED_STATUS_ID ?? INVOICENINJA_DEFAULT_EXPECTED.status_id),
  amount: Number(process.env.PSS_INVOICENINJA_EXPECTED_AMOUNT ?? INVOICENINJA_DEFAULT_EXPECTED.amount),
  balance: Number(process.env.PSS_INVOICENINJA_EXPECTED_BALANCE ?? INVOICENINJA_DEFAULT_EXPECTED.balance)
};

const result = await evaluateInvoiceNinjaInvoice({ invoiceNumber, expected });
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
