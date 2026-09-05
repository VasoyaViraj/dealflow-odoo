# Demo Script --- Phase 3 Quotation Engine

## Scenario

Sales rep creates a quotation for Acme Corp.

## Steps

1.  Open Sales Dashboard.
2.  Open Quotation List.
3.  Click **New Quotation**.
4.  Select **Acme Corp**.
5.  Add **Laptop**, quantity `2`, unit price `₹80,000`.
6.  Add **Setup Service**, quantity `1`, unit price `₹20,000`.
7.  Add **Cloud Pro**, quantity `5`, unit price `₹5,000/month`.
8.  Change a quantity and demonstrate live total recalculation.
9.  Apply a discount.
10. Show subtotal, discount, tax, and grand total.
11. Show margin and margin percentage.
12. Click **Save Draft**.
13. Refresh the page and confirm the same totals.
14. Click **Submit**.
15. Confirm the quotation becomes read-only.

## Expected Outcome

The displayed values match backend-calculated values, the quotation is
persisted, and the submitted quotation cannot be edited.
