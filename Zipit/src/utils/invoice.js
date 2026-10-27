export const downloadInvoice = (order, onToast = null) => {
  if (order.status === 'Cancelled') {
    if (onToast) {
      onToast("Invoices are not available for cancelled orders.");
    } else {
      console.warn("Invoices are not available for cancelled orders.");
    }
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
            padding: 32px 24px; 
            color: #111827; 
            max-width: 640px; 
            margin: 0 auto; 
            background: #F8F9FA;
            font-size: 13px;
            line-height: 1.5;
          }

          .invoice-card-frame {
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 24px 28px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          }
          
          .invoice-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 1px solid #E5E7EB;
            padding-bottom: 12px;
          }

          .brand-logo-mark {
            font-family: 'Cinzel', serif;
            font-size: 18px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.3px;
            line-height: 1.1;
          }

          .brand-tagline {
            font-size: 9px;
            color: #6B7280;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-top: 3px;
            font-weight: 600;
          }

          .invoice-title {
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #111827;
            text-align: right;
            margin: 0;
            line-height: 1.1;
          }

          .billed-meta-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
          }

          .meta-block {
            max-width: 55%;
          }

          .meta-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #111827;
            margin-bottom: 5px;
          }

          .meta-text {
            color: #1F2937;
            font-size: 12.5px;
          }

          .meta-subtext {
            font-size: 11.5px;
            color: #6B7280;
            margin-top: 2px;
          }

          .meta-right {
            text-align: right;
          }

          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          .invoice-table th {
            text-align: left;
            padding: 8px 0;
            border-top: 1.2px solid #111827;
            border-bottom: 1.2px solid #111827;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #111827;
          }

          .invoice-table td {
            padding: 10px 0;
            border-bottom: 1px solid #F1F5F9;
            color: #1E293B;
            font-size: 12px;
            vertical-align: top;
          }

          .invoice-table th.num, .invoice-table td.num {
            text-align: right;
          }

          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 28px;
          }

          .totals-table {
            width: 210px;
          }

          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 11.5px;
            color: #4B5563;
          }

          .totals-row.grand-total {
            border-top: 1.5px solid #111827;
            border-bottom: 1.5px solid #111827;
            margin-top: 6px;
            padding: 7px 0;
            font-size: 13.5px;
            font-weight: 800;
            color: #111827;
          }

          .thank-you-note {
            font-family: 'Cinzel', serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 1px;
            color: #374151;
            margin-bottom: 22px;
          }

          .payment-info-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 16px;
            border-top: 1px dashed #CBD5E1;
          }

          .payment-info-title {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #111827;
            margin-bottom: 3px;
          }

          .signature-mark {
            font-family: 'Cinzel', serif;
            font-size: 15px;
            font-weight: 700;
            color: #111827;
            text-align: right;
          }

          @media print {
            body { 
              padding: 0; 
              background: #fff; 
            }
            .invoice-card-frame {
              border: 1.5px solid #111827;
              border-radius: 8px;
              padding: 28px 32px;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-card-frame">
        <div class="invoice-top">
          <div>
            <div class="brand-logo-mark">QUICKLY &amp; CO.</div>
            <div class="brand-tagline">Quickly ~ Fastest Delivery</div>
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
              <span>Total Amount</span>
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
              Computer-generated e-invoice for Quickly Quick Commerce
            </div>
          </div>
          <div>
            <div class="signature-mark">Quickly Express</div>
            <div style="font-size: 11px; color: #6B7280; text-align: right; margin-top: 2px;">
              zipitrural@gmail.com
            </div>
          </div>
        </div>
        </div>

        <script>
          var hasPrinted = false;
          window.addEventListener('load', function() {
            if (!hasPrinted) {
              hasPrinted = true;
              setTimeout(function() {
                window.focus();
                window.print();
              }, 150);
            }
          });
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
