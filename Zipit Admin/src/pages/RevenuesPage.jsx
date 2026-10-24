import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  CreditCard, 
  Banknote, 
  ShoppingBag, 
  RotateCcw, 
  ArrowUpRight, 
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Download
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import './RevenuesPage.css';

const RevenuesPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // 'today' | 'week' | 'month' | 'year' | 'all'
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState('ALL'); // 'ALL' | 'ONLINE' | 'COD'

  useEffect(() => {
    fetchOrderData();
  }, []);

  const fetchOrderData = async () => {
    setLoading(true);
    try {
      const data = await db.orders.getAllAdmin();
      setOrders(data || []);
    } catch (e) {
      console.error('Failed to load revenue data:', e);
    } finally {
      setLoading(false);
    }
  };

  // 1. Time Filtering Logic
  const getFilteredOrders = () => {
    const now = new Date();
    return orders.filter(order => {
      // Filter out purely cancelled orders unless examining gross GMV
      const isCancelled = order.status === 'Cancelled';
      if (isCancelled) return false;

      const orderDate = new Date(order.created_at);

      if (timeRange === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (timeRange === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= oneWeekAgo;
      }
      if (timeRange === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      if (timeRange === 'year') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  };

  const filteredOrders = getFilteredOrders();

  // 2. Metrics Calculations
  const grossRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  // Total delivery charges collected
  const totalDeliveryFees = filteredOrders.reduce((sum, o) => sum + (Number(o.delivery_fee) || 0), 0);
  
  // Total tips given to riders
  const totalRiderTips = filteredOrders.reduce((sum, o) => sum + (Number(o.tip_amount) || 0), 0);
  
  // Total item sales (Net Products GMV)
  const netProductSales = grossRevenue - totalDeliveryFees - totalRiderTips;

  // Average Order Value (AOV)
  const aov = filteredOrders.length > 0 ? Math.round(grossRevenue / filteredOrders.length) : 0;

  // Payment Breakdown (COD vs Online)
  let onlineRevenue = 0;
  let codRevenue = 0;
  let onlineOrderCount = 0;
  let codOrderCount = 0;

  filteredOrders.forEach(o => {
    const mode = (o.payment_mode || o.payment_method || '').toUpperCase();
    const isOnline = mode.includes('ONLINE') || mode.includes('UPI') || mode.includes('RAZORPAY') || mode.includes('PAID');
    const amt = Number(o.total) || 0;
    if (isOnline) {
      onlineRevenue += amt;
      onlineOrderCount++;
    } else {
      codRevenue += amt;
      codOrderCount++;
    }
  });

  // Calculate Refunded / Disputed value
  const totalRefunded = orders
    .filter(o => o.status === 'Refunded' || o.status === 'Refund Processed')
    .reduce((sum, o) => sum + (Number(o.refund_amount) || Number(o.total) || 0), 0);

  // 3. Chart Timeline Data Generator
  const generateTrendData = () => {
    if (timeRange === 'today') {
      // Group by 4-hour intervals
      const slots = ['12 AM - 4 AM', '4 AM - 8 AM', '8 AM - 12 PM', '12 PM - 4 PM', '4 PM - 8 PM', '8 PM - 12 AM'];
      return slots.map((label, idx) => {
        const startH = idx * 4;
        const endH = startH + 4;
        const bucketOrders = filteredOrders.filter(o => {
          const h = new Date(o.created_at).getHours();
          return h >= startH && h < endH;
        });
        return {
          name: label,
          revenue: bucketOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
          orders: bucketOrders.length
        };
      });
    }

    if (timeRange === 'week') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const past7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = days[d.getDay()];
        const dayOrders = filteredOrders.filter(o => new Date(o.created_at).toDateString() === d.toDateString());
        past7.push({
          name: dayName,
          revenue: dayOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
          orders: dayOrders.length
        });
      }
      return past7;
    }

    // Default: Group by Last 6 Months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(currentMonth - i);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const mOrders = orders.filter(o => {
        if (o.status === 'Cancelled') return false;
        const od = new Date(o.created_at);
        return od.getMonth() === mIdx && od.getFullYear() === y;
      });
      trend.push({
        name: months[mIdx],
        revenue: mOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0),
        orders: mOrders.length
      });
    }
    return trend;
  };

  const trendData = generateTrendData();

  const paymentPieData = [
    { name: 'Online / UPI', value: onlineRevenue, color: '#16A34A' },
    { name: 'Cash on Delivery (COD)', value: codRevenue, color: '#F59E0B' }
  ];

  // CSV Export
  const exportRevenueCSV = () => {
    const headers = ['Order ID,Date,Status,Payment Mode,Items Count,Delivery Fee,Tip,Total Amount'];
    const rows = filteredOrders.map(o => [
      o.id.slice(0, 8),
      new Date(o.created_at).toLocaleDateString(),
      o.status,
      o.payment_mode || 'COD',
      Array.isArray(o.items) ? o.items.length : 1,
      o.delivery_fee || 0,
      o.tip_amount || 0,
      o.total || 0
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `zipit_revenue_report_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="revenues-page">
      {/* Header with Title & Time Range Filter */}
      <div className="revenues-header">
        <div>
          <h1 className="revenues-title">Revenue & Financial Intelligence</h1>
          <p className="revenues-subtitle">
            Comprehensive audit of gross merchandise value (GMV), payment channels, and transaction settlements.
          </p>
        </div>

        <div className="revenues-controls">
          <div className="time-range-selector">
            <button className={timeRange === 'today' ? 'active' : ''} onClick={() => setTimeRange('today')}>Today</button>
            <button className={timeRange === 'week' ? 'active' : ''} onClick={() => setTimeRange('week')}>This Week</button>
            <button className={timeRange === 'month' ? 'active' : ''} onClick={() => setTimeRange('month')}>This Month</button>
            <button className={timeRange === 'year' ? 'active' : ''} onClick={() => setTimeRange('year')}>This Year</button>
            <button className={timeRange === 'all' ? 'active' : ''} onClick={() => setTimeRange('all')}>All Time</button>
          </div>

          <button className="export-csv-btn" onClick={exportRevenueCSV} title="Export financial ledger to CSV">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="revenues-kpi-grid">
        <div className="kpi-card gold-border">
          <div className="kpi-header">
            <span className="kpi-label">Gross Merchandise Value (GMV)</span>
            <div className="kpi-icon-badge gold">
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="kpi-value">₹{grossRevenue.toLocaleString('en-IN')}</div>
          <div className="kpi-subtext positive">
            <TrendingUp size={14} />
            <span>{filteredOrders.length} Paid & Active Orders</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Average Order Value (AOV)</span>
            <div className="kpi-icon-badge blue">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="kpi-value">₹{aov.toLocaleString('en-IN')}</div>
          <div className="kpi-subtext neutral">
            <span>Basket size efficiency</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Online / UPI Collections</span>
            <div className="kpi-icon-badge green">
              <CreditCard size={20} />
            </div>
          </div>
          <div className="kpi-value">₹{onlineRevenue.toLocaleString('en-IN')}</div>
          <div className="kpi-subtext positive">
            <span>{onlineOrderCount} orders ({grossRevenue > 0 ? Math.round((onlineRevenue / grossRevenue) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Cash on Delivery (COD)</span>
            <div className="kpi-icon-badge orange">
              <Banknote size={20} />
            </div>
          </div>
          <div className="kpi-value">₹{codRevenue.toLocaleString('en-IN')}</div>
          <div className="kpi-subtext neutral">
            <span>{codOrderCount} cash pickups ({grossRevenue > 0 ? Math.round((codRevenue / grossRevenue) * 100) : 0}%)</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Revenue Trends & Payment Distribution */}
      <div className="revenues-charts-row">
        {/* Main Revenue Area Chart */}
        <div className="chart-card flex-2">
          <div className="chart-card-header">
            <div>
              <h3>Revenue Trajectory</h3>
              <p>Total transaction volume over the selected window</p>
            </div>
            <span className="chart-badge">₹{grossRevenue.toLocaleString('en-IN')} Total</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Revenue']}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#16A34A" strokeWidth={3} fillOpacity={1} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Channels Pie Breakdown */}
        <div className="chart-card flex-1">
          <div className="chart-card-header">
            <div>
              <h3>Payment Channel Share</h3>
              <p>Split between Digital UPI and Cash on Delivery</p>
            </div>
          </div>
          <div className="chart-wrapper pie-container">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Amount']}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Custom Legend */}
            <div className="pie-legend">
              <div className="legend-item">
                <span className="dot" style={{ background: '#16A34A' }}></span>
                <span className="name">Online / UPI</span>
                <span className="val">₹{onlineRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="legend-item">
                <span className="dot" style={{ background: '#F59E0B' }}></span>
                <span className="name">Cash on Delivery</span>
                <span className="val">₹{codRevenue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Breakdown Banner */}
      <div className="revenue-breakdown-banner">
        <div className="breakdown-stat">
          <span className="stat-title">Net Products GMV</span>
          <span className="stat-num">₹{Math.max(0, netProductSales).toLocaleString('en-IN')}</span>
          <span className="stat-desc">Base items sold</span>
        </div>
        <div className="breakdown-divider"></div>
        <div className="breakdown-stat">
          <span className="stat-title">Delivery Fees Collected</span>
          <span className="stat-num">₹{totalDeliveryFees.toLocaleString('en-IN')}</span>
          <span className="stat-desc">Customer logistics fees</span>
        </div>
        <div className="breakdown-divider"></div>
        <div className="breakdown-stat">
          <span className="stat-title">Rider Tips Disbursed</span>
          <span className="stat-num">₹{totalRiderTips.toLocaleString('en-IN')}</span>
          <span className="stat-desc">100% rider pass-through</span>
        </div>
        <div className="breakdown-divider"></div>
        <div className="breakdown-stat">
          <span className="stat-title">Total Processed Refunds</span>
          <span className="stat-num" style={{ color: '#ef4444' }}>₹{totalRefunded.toLocaleString('en-IN')}</span>
          <span className="stat-desc">Substitutes & claims</span>
        </div>
      </div>

      {/* Recent High-Value Transactions Table */}
      <div className="transactions-table-card">
        <div className="table-header">
          <h3>Latest Settlements & Transactions</h3>
          <span className="table-caption">Showing recent completed orders</span>
        </div>

        <div className="table-responsive">
          <table className="revenues-table">
            <thead>
              <tr>
                <th>Order Ref</th>
                <th>Customer</th>
                <th>Date & Time</th>
                <th>Mode</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Order Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 10).map((order) => {
                const mode = (order.payment_mode || order.payment_method || 'COD').toUpperCase();
                const isOnline = mode.includes('ONLINE') || mode.includes('UPI');
                return (
                  <tr key={order.id}>
                    <td>
                      <span className="order-id-badge">#{order.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">
                          {order.profiles?.name || order.delivery_address?.name || 'Customer'}
                        </span>
                        <span className="customer-sub">
                          {order.profiles?.phone || order.delivery_address?.phone || ''}
                        </span>
                      </div>
                    </td>
                    <td className="date-cell">
                      {new Date(order.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td>
                      <span className={`payment-pill ${isOnline ? 'online' : 'cod'}`}>
                        {isOnline ? 'UPI / Online' : 'Cash on Delivery'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--color-text, #0f172a)' }}>
                      ₹{Number(order.total || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    No settled transactions found in this time range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RevenuesPage;
