export const downloadInvoice = (order) => {
  if (order.status === 'Cancelled') {
    alert("Invoices are not available for cancelled orders.");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=500,height=700');
  if (!printWindow) return;

  const orderDate = new Date(order.created_at || Date.now()).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isRefunded = order.status === 'Refunded' || order.status === 'Refund Requested';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice #${order.id.slice(0, 8).toUpperCase()}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; max-width: 480px; margin: 0 auto; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0c831f; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 28px; font-weight: 900; color: #0c831f; letter-spacing: -1px; margin: 0; }
          .sub-header { font-size: 13px; color: #64748b; font-weight: 600; margin-top: 2px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-top: 8px; }
          .badge-green { background: #dcfce7; color: #15803d; }
          .badge-red { background: #fee2e2; color: #dc2626; }
          .info-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 13px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .info-row:last-child { margin-bottom: 0; }
          .label { color: #64748b; font-weight: 600; }
          .val { font-weight: 700; color: #0f172a; }
          .table-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          .item-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .item-left { display: flex; flex-direction: column; gap: 2px; }
          .item-name { font-weight: 700; color: #0f172a; }
          .item-sub { font-size: 11px; color: #dc2626; font-weight: 600; }
          .item-price { font-weight: 800; color: #0f172a; }
          .total-block { margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 14px; font-size: 16px; display: flex; justify-content: space-between; font-weight: 900; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="brand">Zipit</h1>
          <div class="sub-header">Quick Commerce Official Receipt</div>
          <div class="status-badge ${isRefunded ? 'badge-red' : 'badge-green'}">
            ${order.status}
          </div>
        </div>

        <div class="info-block">
          <div class="info-row"><span class="label">Order ID:</span><span class="val">#${order.id.slice(0, 8).toUpperCase()}</span></div>
          <div class="info-row"><span class="label">Date & Time:</span><span class="val">${orderDate}</span></div>
          <div class="info-row"><span class="label">Payment Method:</span><span class="val">${order.payment_method || 'Online'}</span></div>
          ${order.delivery_address?.name ? `<div class="info-row"><span class="label">Customer:</span><span class="val">${order.delivery_address.name}</span></div>` : ''}
        </div>

        <div class="table-title">Order Items</div>
        ${(order.items || []).map(item => `
          <div class="item-row">
            <div class="item-left">
              <span class="item-name">${item.qty}× ${item.name}</span>
              ${item.is_refund_chosen || item.status === 'REFUNDED_SUBSTITUTE' ? `<span class="item-sub">(Refund Requested)</span>` : ''}
              ${item.is_substituted ? `<span class="item-sub" style="color:#15803d">(Substituted Product)</span>` : ''}
            </div>
            <span class="item-price">₹${item.price * item.qty}</span>
          </div>
        `).join('')}

        <div style="margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 13px;">
          <div class="info-row"><span class="label">Item Total:</span><span class="val">₹${(order.items || []).reduce((acc, i) => acc + (i.price * i.qty), 0)}</span></div>
          ${order.delivery_charge ? `<div class="info-row"><span class="label">Delivery Charge:</span><span class="val">₹${order.delivery_charge}</span></div>` : ''}
          ${order.small_cart_charge ? `<div class="info-row"><span class="label">Small Cart Fee:</span><span class="val">₹${order.small_cart_charge}</span></div>` : ''}
          ${order.discount_amount ? `<div class="info-row"><span class="label">Coupon Discount:</span><span class="val" style="color:#16a34a">-₹${order.discount_amount}</span></div>` : ''}
        </div>

        <div class="total-block">
          <span>Grand Total</span>
          <span style="color: #0c831f;">₹${order.total}</span>
        </div>

        <div class="footer">
          Thank you for ordering with <strong>Zipit</strong>!<br/>
          For customer support: support@zipit.com
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
