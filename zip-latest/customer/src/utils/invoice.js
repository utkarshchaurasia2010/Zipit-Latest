export const downloadInvoice = (order) => {
  if (order.status === 'Cancelled') {
    alert("Invoices are not available for cancelled orders.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=600,height=850');
  if (!printWindow) return;

  const orderDate = new Date(order.created_at || Date.now()).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isRefunded = order.status === 'Refunded' || order.status === 'Refund Requested';
  const isPickup = order.delivery_address?.is_pickup === true || order.delivery_address?.order_type === 'PICKUP';

  // Extract address metadata tags
  const addr = order.delivery_address || {};
  const details = addr.details || addr.address || '';
  const landmark = addr.landmark || details.match(/---TAG:LANDMARK:(.*?)---/)?.[1];
  const villageArea = addr.village_area || details.match(/---TAG:VILLAGE:(.*?)---/)?.[1];
  const familyHead = addr.family_head || details.match(/---TAG:FAMILY_HEAD:(.*?)---/)?.[1];
  const altPhone = addr.alt_phone || details.match(/---TAG:ALT_PHONE:(.*?)---/)?.[1];
  const cleanAddress = details.split('\n---TAG:')[0] || (isPickup ? 'Zipit Dark Store & Hub, Main Market, Rauza' : 'Customer Location');

  const subtotal = (order.items || []).reduce((acc, i) => acc + ((Number(i.price) || 0) * (Number(i.qty) || 1)), 0);
  const deliveryCharge = Number(order.delivery_charge) || 0;
  const handlingCharge = Number(order.small_cart_charge) || 0;
  const discountAmount = Number(order.discount_amount) || 0;

  // Approximate GST breakdown (5% included)
  const gstEstimated = Math.round((subtotal * 0.05 / 1.05) * 100) / 100;
  const cgst = (gstEstimated / 2).toFixed(2);
  const sgst = (gstEstimated / 2).toFixed(2);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - #${order.id.slice(0, 8).toUpperCase()}</title>
        <style>
          @page { size: auto; margin: 12mm; }
          body { 
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; 
            padding: 24px; 
            color: #0f172a; 
            max-width: 520px; 
            margin: 0 auto; 
            line-height: 1.45;
            background: #fff;
          }
          .header { text-align: center; border-bottom: 2.5px solid #0c831f; padding-bottom: 14px; margin-bottom: 16px; }
          .brand { font-size: 32px; font-weight: 900; color: #0c831f; letter-spacing: -1.5px; margin: 0; }
          .sub-brand { font-size: 11.5px; color: #475467; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 2px; }
          .store-contact { font-size: 11px; color: #64748b; margin-top: 4px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11.5px; font-weight: 800; text-transform: uppercase; margin-top: 8px; }
          .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge-red { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
          .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
          
          .grid-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; font-size: 12.5px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .row:last-child { margin-bottom: 0; }
          .lbl { color: #64748b; font-weight: 600; }
          .val { font-weight: 700; color: #0f172a; text-align: right; }
          
          .address-card { background: #f1f5f9; border-radius: 10px; padding: 10px 12px; margin-top: 8px; font-size: 12px; }
          .tag-pill { display: inline-block; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-top: 4px; margin-right: 4px; }
          
          .items-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12.5px; }
          .items-table th { text-align: left; padding: 8px 4px; border-bottom: 1.5px solid #cbd5e1; color: #475467; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
          .items-table td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
          .item-name { font-weight: 700; color: #0f172a; font-size: 13px; }
          .item-sub { font-size: 11px; color: #dc2626; font-weight: 600; }
          .num-col { text-align: right; }

          .breakdown-box { margin-top: 12px; border-top: 1.5px dashed #cbd5e1; padding-top: 10px; font-size: 12.5px; }
          .breakdown-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .grand-total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 8px; color: #0c831f; }

          .gst-note { font-size: 11px; color: #64748b; background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 6px 10px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="brand">Zipit</h1>
          <div class="sub-brand">Instant 10-Minute Grocery & Essentials</div>
          <div class="store-contact">Dark Store Hub, Rauza, Ghazipur, UP | Support: support@zipit.com</div>
          <div class="status-badge ${isRefunded ? 'badge-red' : order.status === 'Delivered' ? 'badge-green' : 'badge-blue'}">
            ${isPickup ? '🛍️ STORE PICKUP' : '🛵 HOME DELIVERY'} • ${order.status}
          </div>
        </div>

        <div class="grid-card">
          <div class="row"><span class="lbl">Invoice Number:</span><span class="val">#INV-${order.id.slice(0, 8).toUpperCase()}</span></div>
          <div class="row"><span class="lbl">Date & Time:</span><span class="val">${orderDate}</span></div>
          <div class="row"><span class="lbl">Customer Name:</span><span class="val">${addr.name || order.profiles?.name || 'Customer'}</span></div>
          ${(addr.phone || order.profiles?.phone) ? `<div class="row"><span class="lbl">Customer Phone:</span><span class="val">${addr.phone || order.profiles?.phone}</span></div>` : ''}
          <div class="row"><span class="lbl">Payment Method:</span><span class="val">${order.payment_method || 'Online (UPI)'}</span></div>
          
          <div class="address-card">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px;">
              ${isPickup ? 'Store Pickup Details:' : 'Delivery Destination:'}
            </div>
            <div style="color: #475467;">${cleanAddress}</div>
            ${landmark ? `<span class="tag-pill" style="background:#fee2e2; color:#b91c1c;">🚩 Landmark: ${landmark}</span>` : ''}
            ${villageArea ? `<span class="tag-pill" style="background:#e0f2fe; color:#0369a1;">📍 Area: ${villageArea}</span>` : ''}
            ${familyHead ? `<span class="tag-pill" style="background:#fef3c7; color:#92400e;">🏠 House/Head: ${familyHead}</span>` : ''}
            ${altPhone ? `<span class="tag-pill" style="background:#f1f5f9; color:#475467;">📞 Alt: ${altPhone}</span>` : ''}
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">Item Description</th>
              <th class="num-col" style="width: 15%;">Qty</th>
              <th class="num-col" style="width: 15%;">Rate</th>
              <th class="num-col" style="width: 20%;">Total</th>
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
                    <div class="item-name">${item.name}</div>
                    ${item.is_refund_chosen || item.status === 'REFUNDED_SUBSTITUTE' ? `<div class="item-sub">🚫 Refund Requested</div>` : ''}
                    ${item.is_substituted ? `<div class="item-sub" style="color:#15803d">🔄 Substituted Item</div>` : ''}
                  </td>
                  <td class="num-col">${qty}</td>
                  <td class="num-col">₹${price}</td>
                  <td class="num-col" style="font-weight: 700;">₹${lineTotal}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="breakdown-box">
          <div class="breakdown-row"><span class="lbl">Items Subtotal:</span><span class="val">₹${subtotal}</span></div>
          ${handlingCharge > 0 ? `<div class="breakdown-row"><span class="lbl">Handling / Platform Fee:</span><span class="val">₹${handlingCharge}</span></div>` : ''}
          ${deliveryCharge > 0 ? `
            <div class="breakdown-row"><span class="lbl">Delivery Fee:</span><span class="val">₹${deliveryCharge}</span></div>
          ` : `
            <div class="breakdown-row"><span class="lbl">Delivery Fee:</span><span class="val" style="color: #15803d;">FREE</span></div>
          `}
          ${discountAmount > 0 ? `<div class="breakdown-row"><span class="lbl">Discounts & Coupons:</span><span class="val" style="color: #16a34a;">-₹${discountAmount}</span></div>` : ''}
          
          <div class="grand-total-row">
            <span>Grand Total</span>
            <span>₹${order.total}</span>
          </div>
        </div>

        <div class="gst-note">
          <strong>Tax Summary:</strong> Total GST included approx ₹${gstEstimated} (CGST 2.5%: ₹${cgst}, SGST 2.5%: ₹${sgst}).
        </div>

        <div class="footer">
          This is a computer-generated tax invoice issued by <strong>Zipit Quick Commerce</strong>.<br/>
          Thank you for choosing Zipit for lightning-fast deliveries!
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
