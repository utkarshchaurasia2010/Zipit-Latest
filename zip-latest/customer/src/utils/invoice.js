export const downloadInvoice = (order) => {
  if (order.status === 'Cancelled') {
    alert("Invoices are not available for cancelled orders.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=650,height=900');
  if (!printWindow) return;

  const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const isPickup = order.delivery_address?.is_pickup === true || order.delivery_address?.order_type === 'PICKUP';

  // Extract address metadata
  const addr = order.delivery_address || {};
  const details = addr.details || addr.address || '';
  const landmark = addr.landmark || details.match(/---TAG:LANDMARK:(.*?)---/)?.[1];
  const villageArea = addr.village_area || details.match(/---TAG:VILLAGE:(.*?)---/)?.[1];
  const cleanAddress = details.split('\n---TAG:')[0] || (isPickup ? 'Zipit Store Hubs' : 'Customer Address');

  const subtotal = (order.items || []).reduce((acc, i) => acc + ((Number(i.price) || 0) * (Number(i.qty) || 1)), 0);
  const deliveryCharge = Number(order.delivery_charge) || 0;
  const handlingCharge = Number(order.small_cart_charge) || 0;
  const discountAmount = Number(order.discount_amount) || 0;
  const total = Number(order.total) || 0;

  const invoiceNo = `INV-${order.id.slice(0, 8).toUpperCase()}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${invoiceNo}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; 
            padding: 40px 48px; 
            color: #111827; 
            max-width: 620px; 
            margin: 0 auto; 
            background: #FDFCF7;
            font-size: 13px;
            line-height: 1.5;
          }
          
          .invoice-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
          }

          .brand-logo-mark {
            font-family: 'Cinzel', serif;
            font-size: 38px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -1.5px;
            line-height: 1;
          }

          .brand-tagline {
            font-size: 11px;
            color: #6B7280;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-top: 4px;
            font-weight: 600;
          }

          .invoice-title {
            font-family: 'Cinzel', serif;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #111827;
            text-align: right;
            margin: 0;
          }

          .billed-meta-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 36px;
          }

          .meta-block {
            max-width: 55%;
          }

          .meta-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #111827;
            margin-bottom: 6px;
          }

          .meta-text {
            color: #4B5563;
            font-size: 13px;
          }

          .meta-subtext {
            font-size: 12px;
            color: #6B7280;
            margin-top: 2px;
          }

          .meta-right {
            text-align: right;
          }

          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }

          .invoice-table th {
            text-align: left;
            padding: 10px 0;
            border-top: 1.5px solid #111827;
            border-bottom: 1.5px solid #111827;
            font-size: 11.5px;
            font-weight: 700;
            text-transform: capitalize;
            color: #111827;
          }

          .invoice-table td {
            padding: 14px 0;
            border-bottom: 1px solid #E5E7EB;
            color: #111827;
            font-size: 13px;
            vertical-align: top;
          }

          .invoice-table th.num, .invoice-table td.num {
            text-align: right;
          }

          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
          }

          .totals-table {
            width: 240px;
          }

          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
            color: #4B5563;
          }

          .totals-row.grand-total {
            border-top: 1.5px solid #111827;
            border-bottom: 1.5px solid #111827;
            margin-top: 8px;
            padding: 12px 0;
            font-size: 18px;
            font-weight: 800;
            color: #111827;
          }

          .thank-you-note {
            font-family: 'Cinzel', serif;
            font-size: 20px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 32px;
          }

          .payment-info-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 20px;
            border-top: 1px dashed #D1D5DB;
          }

          .payment-info-title {
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #111827;
            margin-bottom: 4px;
          }

          .signature-mark {
            font-family: 'Cinzel', serif;
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            text-align: right;
          }

          @media print {
            body { 
              padding: 0; 
              background: #fff; 
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-top">
          <div>
            <div class="brand-logo-mark">ZIPIT & CO.</div>
            <div class="brand-tagline">Rural & Semi-Urban Express Delivery</div>
          </div>
          <div>
            <h1 class="invoice-title">INVOICE</h1>
          </div>
        </div>

        <div class="billed-meta-row">
          <div class="meta-block">
            <div class="meta-title">BILLED TO:</div>
            <div class="meta-text" style="font-weight: 700;">${addr.name || order.profiles?.name || 'Customer'}</div>
            ${(addr.phone || order.profiles?.phone) ? `<div class="meta-subtext">${addr.phone || order.profiles?.phone}</div>` : ''}
            <div class="meta-subtext">${cleanAddress}</div>
            ${landmark ? `<div class="meta-subtext">Landmark: ${landmark}</div>` : ''}
            ${villageArea ? `<div class="meta-subtext">Area: ${villageArea}</div>` : ''}
          </div>

          <div class="meta-right">
            <div style="font-weight: 700; color: #111827;">Invoice No. ${order.id.slice(0, 8).toUpperCase()}</div>
            <div style="color: #6B7280; font-size: 12px; margin-top: 3px;">${orderDate}</div>
            <div style="font-size: 11.5px; margin-top: 6px; font-weight: 600; color: #16A34A;">
              ${order.status} (${isPickup ? 'STORE PICKUP' : 'EXPRESS DELIVERY'})
            </div>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th style="width: 50%;">Item</th>
              <th class="num" style="width: 15%;">Quantity</th>
              <th class="num" style="width: 15%;">Unit Price</th>
              <th class="num" style="width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(item => {
              const qty = Number(item.qty) || 1;
              const price = Number(item.price) || 0;
              const lineTotal = qty * price;
              return `
                <tr>
                  <td>
                    <strong>${item.name}</strong>
                    ${item.is_refund_chosen ? `<div style="font-size: 11px; color: #DC2626;">Refund requested</div>` : ''}
                    ${item.is_substituted ? `<div style="font-size: 11px; color: #16A34A;">Substituted product</div>` : ''}
                  </td>
                  <td class="num">${qty}</td>
                  <td class="num">₹${price}</td>
                  <td class="num" style="font-weight: 600;">₹${lineTotal}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="totals-container">
          <div class="totals-table">
            <div class="totals-row">
              <span>Subtotal</span>
              <span>₹${subtotal}</span>
            </div>
            ${handlingCharge > 0 ? `
              <div class="totals-row">
                <span>Handling Fee</span>
                <span>₹${handlingCharge}</span>
              </div>
            ` : ''}
            ${deliveryCharge > 0 ? `
              <div class="totals-row">
                <span>Delivery Fee</span>
                <span>₹${deliveryCharge}</span>
              </div>
            ` : `
              <div class="totals-row">
                <span>Delivery Fee</span>
                <span style="color: #16A34A;">₹0 (Free)</span>
              </div>
            `}
            ${discountAmount > 0 ? `
              <div class="totals-row" style="color: #16A34A;">
                <span>Discount</span>
                <span>-₹${discountAmount}</span>
              </div>
            ` : ''}
            <div class="totals-row grand-total">
              <span>Total</span>
              <span>₹${total}</span>
            </div>
          </div>
        </div>

        <div class="thank-you-note">
          Thank you!
        </div>

        <div class="payment-info-box">
          <div>
            <div class="payment-info-title">PAYMENT INFORMATION</div>
            <div style="font-size: 12.5px; color: #374151;">
              Mode: <strong>${order.payment_method || 'Online (UPI)'}</strong>
            </div>
            <div style="font-size: 11.5px; color: #6B7280; margin-top: 2px;">
              Computer-generated e-invoice for Zipit Quick Commerce
            </div>
          </div>
          <div>
            <div class="signature-mark">Zipit Express</div>
            <div style="font-size: 11px; color: #6B7280; text-align: right; margin-top: 2px;">
              support@zipit.com
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
