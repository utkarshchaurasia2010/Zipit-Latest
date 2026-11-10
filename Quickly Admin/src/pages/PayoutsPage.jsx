import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  IndianRupee, 
  Bike, 
  Store, 
  Calendar, 
  Filter, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Search, 
  RefreshCw,
  CreditCard,
  Check,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { db, supabase } from '../services/db';
import { useToast } from '../context/ToastContext';
import { round2 } from '../utils/commissions';
import './PayoutsPage.css';

export default function PayoutsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('rider'); // 'rider' | 'shop'
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core Data
  const [commissions, setCommissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [branding, setBranding] = useState(null);

  // Filters
  const [datePreset, setDatePreset] = useState('this_month'); // 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom' | 'all'
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'paid'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [payoutModalTarget, setPayoutModalTarget] = useState(null);
  const [statementPartner, setStatementPartner] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    payment_mode: 'upi',
    reference_note: ''
  });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Expanded row IDs
  const [expandedPartnerIds, setExpandedPartnerIds] = useState(new Set());

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [commsData, payoutsData, codesRes, allOrders, brandData] = await Promise.all([
        db.commissions.getAll(),
        db.payouts.getAll(),
        supabase.from('access_codes').select('*').order('name', { ascending: true }),
        db.orders.getAllAdmin ? db.orders.getAllAdmin() : [],
        db.branding.get()
      ]);

      setCommissions(commsData || []);
      setPayouts(payoutsData || []);
      setOrders(allOrders || []);
      setBranding(brandData || null);

      const isApp = (c) => (c.code && c.code.startsWith('APP-')) || (c.label && (c.label.includes('Application') || c.label.includes('Pending')));
      const validPartners = (codesRes?.data || []).filter(c => !isApp(c) && !['RIDER01', 'RIDER02', 'SHOP01'].includes(c.code));
      setPartners(validPartners);
    } catch (err) {
      console.error('Error loading payout data:', err);
      showToast('Error loading payouts data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAllData();
      showToast('Payouts and commissions data refreshed', 'success');
    } catch (_) {}
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Date Range Helper
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (datePreset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    } else if (datePreset === 'this_week') {
      const day = now.getDay() || 7; // Monday = 1
      const d = new Date(now);
      d.setDate(d.getDate() - day + 1);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    } else if (datePreset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (datePreset === 'custom') {
      if (customStart) start = new Date(`${customStart}T00:00:00`);
      if (customEnd) end = new Date(`${customEnd}T23:59:59.999`);
    } else if (datePreset === 'all') {
      start = null;
      end = null;
    }

    return { start, end };
  }, [datePreset, customStart, customEnd]);

  // Filtered partners matching active tab ('rider' or 'shop')
  const activeTabPartners = useMemo(() => {
    const targetRole = activeTab === 'rider' ? 'rider' : 'shopkeeper';
    return partners.filter(p => p.role === targetRole);
  }, [partners, activeTab]);

  // Map orders for fast lookup
  const ordersMap = useMemo(() => {
    const map = new Map();
    orders.forEach(o => map.set(o.id, o));
    return map;
  }, [orders]);

  // Filtered commissions within date range bounds
  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      // Exclude void commissions from settlement
      if (c.status === 'void') return false;

      // Match partner type
      const partnerKey = activeTab === 'rider' ? c.rider_id : c.shop_id;
      if (!partnerKey) return false;

      // Filter by partner dropdown
      if (selectedPartnerId !== 'all' && partnerKey !== selectedPartnerId) {
        return false;
      }

      // Filter by status (pending or paid)
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Filter by date range
      if (dateRangeBounds.start || dateRangeBounds.end) {
        const orderDate = new Date(c.calculated_at || c.created_at);
        if (dateRangeBounds.start && orderDate < dateRangeBounds.start) return false;
        if (dateRangeBounds.end && orderDate > dateRangeBounds.end) return false;
      }

      return true;
    });
  }, [commissions, activeTab, selectedPartnerId, statusFilter, dateRangeBounds]);

  // Aggregate Partner Metrics
  const partnerSummaries = useMemo(() => {
    const summaryMap = new Map();

    // Initialize all partners of active tab
    activeTabPartners.forEach(p => {
      summaryMap.set(p.code, {
        partner: p,
        partner_code: p.code,
        partner_name: p.name || p.label || p.code,
        phone: p.phone || '',
        orderCount: 0,
        totalBasket: 0,
        totalEarned: 0,
        totalPaid: 0,
        balanceDue: 0,
        commissionsList: [],
        payoutsList: []
      });
    });

    // Tally filtered commissions
    filteredCommissions.forEach(c => {
      const partnerKey = activeTab === 'rider' ? c.rider_id : c.shop_id;
      if (!partnerKey) return;

      if (!summaryMap.has(partnerKey)) {
        summaryMap.set(partnerKey, {
          partner: { code: partnerKey, name: partnerKey },
          partner_code: partnerKey,
          partner_name: partnerKey,
          phone: '',
          orderCount: 0,
          totalBasket: 0,
          totalEarned: 0,
          totalPaid: 0,
          balanceDue: 0,
          commissionsList: [],
          payoutsList: []
        });
      }

      const item = summaryMap.get(partnerKey);
      const share = activeTab === 'rider' ? Number(c.rider_share || 0) : Number(c.shop_share || 0);

      item.orderCount += 1;
      item.totalBasket = round2(item.totalBasket + Number(c.subtotal || 0));
      item.totalEarned = round2(item.totalEarned + share);
      item.commissionsList.push(c);
    });

    // Tally historical payouts for this partner type
    const targetType = activeTab === 'rider' ? 'rider' : 'shop';
    payouts.forEach(pay => {
      if (pay.partner_type !== targetType) return;
      if (summaryMap.has(pay.partner_id)) {
        const item = summaryMap.get(pay.partner_id);
        item.totalPaid = round2(item.totalPaid + Number(pay.total_amount || 0));
        item.payoutsList.push(pay);
      }
    });

    // Compute balance due per partner (Earned from pending commissions)
    summaryMap.forEach(item => {
      const pendingEarned = item.commissionsList
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (activeTab === 'rider' ? Number(c.rider_share || 0) : Number(c.shop_share || 0)), 0);
      item.balanceDue = round2(pendingEarned);
    });

    let results = Array.from(summaryMap.values());

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(r => 
        r.partner_name.toLowerCase().includes(q) ||
        r.partner_code.toLowerCase().includes(q) ||
        r.phone.includes(q)
      );
    }

    return results;
  }, [activeTabPartners, filteredCommissions, payouts, activeTab, searchQuery]);

  // Overall Totals
  const overallMetrics = useMemo(() => {
    let earned = 0;
    let paid = 0;
    let balance = 0;
    let ordersCount = 0;

    partnerSummaries.forEach(p => {
      earned += p.totalEarned;
      paid += p.totalPaid;
      balance += p.balanceDue;
      ordersCount += p.orderCount;
    });

    return {
      earned: round2(earned),
      paid: round2(paid),
      balance: round2(balance),
      ordersCount
    };
  }, [partnerSummaries]);

  // Toggle Row Expansion
  const toggleRowExpansion = (code) => {
    setExpandedPartnerIds(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Open Mark As Paid Modal
  const handleOpenPayoutModal = (partnerSummary) => {
    const pendingOrders = partnerSummary.commissionsList.filter(c => c.status === 'pending');
    if (pendingOrders.length === 0 || partnerSummary.balanceDue <= 0) {
      showToast('No outstanding pending commissions to pay for this partner.', 'info');
      return;
    }
    setPayoutModalTarget({
      ...partnerSummary,
      pendingOrders
    });
    setPayoutForm({
      payment_mode: 'upi',
      reference_note: ''
    });
  };

  // Confirm and Submit Payout
  const handleSubmitPayout = async (e) => {
    e.preventDefault();
    if (!payoutModalTarget) return;

    setSubmittingPayout(true);
    try {
      const partnerType = activeTab === 'rider' ? 'rider' : 'shop';
      const orderIds = payoutModalTarget.pendingOrders.map(c => c.order_id);
      const totalAmount = payoutModalTarget.balanceDue;

      const pStart = dateRangeBounds.start ? dateRangeBounds.start.toISOString() : new Date(Date.now() - 30 * 86400000).toISOString();
      const pEnd = dateRangeBounds.end ? dateRangeBounds.end.toISOString() : new Date().toISOString();

      await db.payouts.create({
        partner_type: partnerType,
        partner_id: payoutModalTarget.partner_code,
        period_start: pStart,
        period_end: pEnd,
        total_amount: totalAmount,
        payment_mode: payoutForm.payment_mode,
        reference_note: payoutForm.reference_note || `Payout via ${payoutForm.payment_mode.toUpperCase()}`,
        created_by: 'Super Admin',
        order_ids: orderIds
      });

      // Audit Log
      try {
        await supabase.from('admin_audit_logs').insert([{
          action: 'CREATE_PARTNER_PAYOUT',
          entity_type: 'payout',
          entity_id: payoutModalTarget.partner_code,
          details: {
            partner_type: partnerType,
            partner_id: payoutModalTarget.partner_code,
            orders_settled: orderIds.length,
            amount: totalAmount,
            mode: payoutForm.payment_mode,
            ref: payoutForm.reference_note
          },
          performed_by: 'Super Admin',
          performed_at: new Date().toISOString()
        }]);
      } catch (_) {}

      showToast(`Settlement of ₹${totalAmount} recorded successfully for ${payoutModalTarget.partner_name}!`, 'success');
      setPayoutModalTarget(null);
      await loadAllData();
    } catch (err) {
      console.error('Payout settlement error:', err);
      showToast('Failed to record payout: ' + err.message, 'error');
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Export CSV: All Order Commissions in current filter
  const handleExportAllCommissionsCSV = () => {
    if (filteredCommissions.length === 0) {
      showToast('No commission rows to export.', 'warning');
      return;
    }

    const headers = [
      'Order ID',
      'Calculated Date',
      'Partner Type',
      'Partner Code',
      'Basket Subtotal',
      'Wholesale Cost',
      'Delivery Fee',
      'Shop Share',
      'Rider Share',
      'Platform Margin',
      'Status',
      'Payout ID'
    ];

    const rows = filteredCommissions.map(c => [
      `"${c.order_id}"`,
      `"${new Date(c.calculated_at || c.created_at).toLocaleString('en-IN')}"`,
      activeTab === 'rider' ? 'Rider' : 'Shopkeeper',
      activeTab === 'rider' ? c.rider_id || '' : c.shop_id || '',
      c.subtotal || 0,
      c.wholesale_cost !== null ? c.wholesale_cost : 'N/A',
      c.delivery_fee || 0,
      c.shop_share || 0,
      c.rider_share || 0,
      c.platform_share !== null ? c.platform_share : 'N/A',
      c.status || 'pending',
      c.payout_id || 'unpaid'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `commissions_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CSV: Individual Partner Statement
  const handleExportPartnerStatementCSV = (partnerSummary) => {
    const headers = [
      'Date',
      'Order ID',
      'Basket (Subtotal)',
      'Partner Share (₹)',
      'Status',
      'Payout Date',
      'Reference'
    ];

    const rows = partnerSummary.commissionsList.map(c => {
      const share = activeTab === 'rider' ? c.rider_share : c.shop_share;
      const linkedPayout = payouts.find(p => p.id === c.payout_id);
      return [
        `"${new Date(c.calculated_at || c.created_at).toLocaleDateString('en-IN')}"`,
        `"${c.order_id}"`,
        c.subtotal || 0,
        share || 0,
        c.status || 'pending',
        linkedPayout ? `"${new Date(linkedPayout.paid_at).toLocaleDateString('en-IN')}"` : 'Pending',
        linkedPayout ? `"${linkedPayout.reference_note || linkedPayout.payment_mode}"` : ''
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `statement_${partnerSummary.partner_code}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger Print for Partner Statement Modal
  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="payouts-page-container">
      {/* 1. Header Row */}
      <div className="payouts-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="payouts-title">Commissions & Payouts</h1>
            <span className="payouts-cycle-hint">
              Suggested: Riders Daily · Shops Weekly
            </span>
          </div>
          <p className="payouts-sub">
            Track real-time partner earnings, snapshot commissions, settle balance dues, and download statements.
          </p>
        </div>

        <div className="payouts-header-actions">
          <button 
            type="button" 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="payouts-square-btn outline"
            title="Refresh Data"
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>Sync</span>
          </button>

          <button 
            type="button" 
            onClick={handleExportAllCommissionsCSV}
            className="payouts-square-btn primary"
            title="Export CSV of all commissions in date range"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Partner Type Tabs */}
      <div className="payouts-tabs-bar">
        <button 
          className={`payout-tab-btn ${activeTab === 'rider' ? 'active' : ''}`}
          onClick={() => { setActiveTab('rider'); setSelectedPartnerId('all'); }}
        >
          <Bike size={18} />
          <span>Riders Fleet ({partners.filter(p => p.role === 'rider').length})</span>
        </button>

        <button 
          className={`payout-tab-btn ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => { setActiveTab('shop'); setSelectedPartnerId('all'); }}
        >
          <Store size={18} />
          <span>Dark Stores & Shops ({partners.filter(p => p.role === 'shopkeeper').length})</span>
        </button>
      </div>

      {/* 3. Metric KPI Cards */}
      <div className="payouts-kpi-grid">
        <div className="payouts-kpi-card earned">
          <div className="kpi-icon"><IndianRupee size={20} /></div>
          <div>
            <span className="kpi-label">Total Earned (Commissions)</span>
            <div className="kpi-value">₹{overallMetrics.earned}</div>
            <span className="kpi-sub">{overallMetrics.ordersCount} delivered orders in period</span>
          </div>
        </div>

        <div className="payouts-kpi-card balance">
          <div className="kpi-icon"><Clock size={20} /></div>
          <div>
            <span className="kpi-label">Outstanding Balance Due</span>
            <div className="kpi-value">₹{overallMetrics.balance}</div>
            <span className="kpi-sub">Ready to settle & mark as paid</span>
          </div>
        </div>

        <div className="payouts-kpi-card paid">
          <div className="kpi-icon"><CheckCircle2 size={20} /></div>
          <div>
            <span className="kpi-label">Total Paid Out</span>
            <div className="kpi-value">₹{overallMetrics.paid}</div>
            <span className="kpi-sub">Historically disbursed</span>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="payouts-filter-toolbar">
        {/* Date presets */}
        <div className="filter-group">
          <span className="filter-label"><Calendar size={14} /> Period:</span>
          <div className="preset-buttons-group">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button 
                key={p.id}
                type="button"
                className={`preset-btn ${datePreset === p.id ? 'active' : ''}`}
                onClick={() => setDatePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range inputs */}
        {datePreset === 'custom' && (
          <div className="custom-date-range">
            <input 
              type="date" 
              value={customStart} 
              onChange={e => setCustomStart(e.target.value)} 
              className="payout-date-input"
            />
            <span style={{ color: '#94a3b8' }}>to</span>
            <input 
              type="date" 
              value={customEnd} 
              onChange={e => setCustomEnd(e.target.value)} 
              className="payout-date-input"
            />
          </div>
        )}

        {/* Partner Selector */}
        <div className="filter-group">
          <select 
            value={selectedPartnerId} 
            onChange={e => setSelectedPartnerId(e.target.value)}
            className="payout-select"
          >
            <option value="all">All {activeTab === 'rider' ? 'Riders' : 'Shops'}</option>
            {activeTabPartners.map(p => (
              <option key={p.code} value={p.code}>
                {p.name || p.label || p.code} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="payout-select"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Balance Only</option>
            <option value="paid">Paid Settlements</option>
          </select>
        </div>

        {/* Search */}
        <div className="payout-search-box">
          <Search size={15} color="#94a3b8" />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'rider' ? 'rider' : 'shop'} by name or code...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 5. Main Table of Partner Summaries */}
      <div className="payouts-table-card">
        {loading ? (
          <div className="payouts-loading">Loading partner payouts & commissions...</div>
        ) : partnerSummaries.length === 0 ? (
          <div className="payouts-empty">
            <AlertCircle size={36} color="#94a3b8" />
            <h3>No partner activity found for this period</h3>
            <p>Delivered orders with calculated commissions will automatically appear here.</p>
          </div>
        ) : (
          <table className="payouts-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Partner</th>
                <th>Delivered Orders</th>
                <th>Basket Value</th>
                <th>Total Earned</th>
                <th>Already Paid</th>
                <th>Balance Due</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partnerSummaries.map(item => {
                const isExpanded = expandedPartnerIds.has(item.partner_code);
                return (
                  <React.Fragment key={item.partner_code}>
                    <tr className={`partner-summary-row ${isExpanded ? 'expanded' : ''}`}>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => toggleRowExpansion(item.partner_code)}
                          className="expand-toggle-btn"
                          title="Expand order details"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="partner-name">{item.partner_name}</span>
                          <span className="partner-code-sub">Code: {item.partner_code} {item.phone ? `· ${item.phone}` : ''}</span>
                        </div>
                      </td>
                      <td>
                        <span className="orders-badge">{item.orderCount} orders</span>
                      </td>
                      <td>₹{item.totalBasket}</td>
                      <td>
                        <span style={{ fontWeight: '800', color: '#15803d' }}>₹{item.totalEarned}</span>
                      </td>
                      <td>₹{item.totalPaid}</td>
                      <td>
                        {item.balanceDue > 0 ? (
                          <span className="balance-due-badge">₹{item.balanceDue} Due</span>
                        ) : (
                          <span className="balance-cleared-badge">Cleared (₹0)</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          {item.balanceDue > 0 && (
                            <button 
                              type="button" 
                              onClick={() => handleOpenPayoutModal(item)}
                              className="payouts-square-btn pay-action"
                              title="Settle balance and mark as paid"
                            >
                              <Check size={14} /> Pay ₹{item.balanceDue}
                            </button>
                          )}

                          <button 
                            type="button" 
                            onClick={() => setStatementPartner(item)}
                            className="payouts-square-btn outline"
                            title="View statement & invoice"
                          >
                            <FileText size={14} /> Statement
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded order breakdown sub-table */}
                    {isExpanded && (
                      <tr className="expansion-container-row">
                        <td colSpan={8}>
                          <div className="expansion-details-box">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text)' }}>
                                Order Commission Breakdown for {item.partner_name} ({item.commissionsList.length} orders)
                              </h4>
                              <button 
                                type="button" 
                                onClick={() => handleExportPartnerStatementCSV(item)}
                                className="payouts-square-btn outline sm"
                              >
                                <Download size={13} /> Export CSV
                              </button>
                            </div>

                            {item.commissionsList.length === 0 ? (
                              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No commission rows in current filter range.</p>
                            ) : (
                              <table className="breakdown-subtable">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Order ID</th>
                                    <th>Basket Subtotal</th>
                                    <th>Wholesale Cost</th>
                                    <th>Delivery Fee</th>
                                    <th>Partner Share</th>
                                    <th>Platform Margin</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.commissionsList.map(c => {
                                    const share = activeTab === 'rider' ? c.rider_share : c.shop_share;
                                    const isNegative = typeof c.platform_share === 'number' && c.platform_share < 0;

                                    return (
                                      <tr key={c.id || c.order_id}>
                                        <td>{new Date(c.calculated_at || c.created_at).toLocaleDateString('en-IN')}</td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>#{c.order_id.slice(0, 8).toUpperCase()}</td>
                                        <td>₹{c.subtotal}</td>
                                        <td>{c.wholesale_cost !== null ? `₹${c.wholesale_cost}` : <span style={{ color: '#d97706', fontSize: '11px', fontWeight: '700' }}>Cost Missing</span>}</td>
                                        <td>₹{c.delivery_fee}</td>
                                        <td style={{ fontWeight: '800', color: '#15803d' }}>₹{share}</td>
                                        <td style={{ fontWeight: '700', color: isNegative ? '#dc2626' : 'var(--color-text)' }}>
                                          {c.platform_share !== null ? `₹${c.platform_share}` : '—'}
                                        </td>
                                        <td>
                                          <span className={`comm-status-pill ${c.status || 'pending'}`}>
                                            {c.status || 'pending'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. MODAL: Mark As Paid Dialog */}
      {payoutModalTarget && (
        <div className="payout-modal-overlay" onClick={() => setPayoutModalTarget(null)}>
          <div className="payout-modal-card" onClick={e => e.stopPropagation()}>
            <div className="payout-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#16a34a" />
                <h3>Settle & Record Partner Payout</h3>
              </div>
              <button onClick={() => setPayoutModalTarget(null)} className="payout-modal-close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayout} className="payout-modal-form">
              <div className="payout-modal-info-box">
                <div className="info-row">
                  <span>Partner:</span>
                  <strong>{payoutModalTarget.partner_name} ({payoutModalTarget.partner_code})</strong>
                </div>
                <div className="info-row">
                  <span>Role:</span>
                  <span>{activeTab === 'rider' ? 'Delivery Rider' : 'Dark Store / Shop'}</span>
                </div>
                <div className="info-row">
                  <span>Eligible Orders:</span>
                  <span>{payoutModalTarget.pendingOrders.length} pending orders</span>
                </div>
                <div className="info-row total-row">
                  <span>Total Settlement Amount:</span>
                  <span className="payout-amt">₹{payoutModalTarget.balanceDue}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label>Payment Mode</label>
                <div className="payment-mode-options">
                  <label className={`mode-choice ${payoutForm.payment_mode === 'upi' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="payment_mode" 
                      value="upi" 
                      checked={payoutForm.payment_mode === 'upi'}
                      onChange={() => setPayoutForm(prev => ({ ...prev, payment_mode: 'upi' }))}
                    />
                    <span>UPI / Online Transfer</span>
                  </label>
                  <label className={`mode-choice ${payoutForm.payment_mode === 'cash' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="payment_mode" 
                      value="cash" 
                      checked={payoutForm.payment_mode === 'cash'}
                      onChange={() => setPayoutForm(prev => ({ ...prev, payment_mode: 'cash' }))}
                    />
                    <span>Cash on Hand</span>
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Reference / Transaction Note</label>
                <input 
                  type="text" 
                  placeholder={payoutForm.payment_mode === 'upi' ? 'e.g. UPI Ref / UTR 432109876543' : 'e.g. Handed cash at warehouse counter'}
                  value={payoutForm.reference_note}
                  onChange={e => setPayoutForm(prev => ({ ...prev, reference_note: e.target.value }))}
                  className="clean-input"
                  required
                />
              </div>

              <div className="modal-actions-row">
                <button 
                  type="button" 
                  onClick={() => setPayoutModalTarget(null)}
                  className="payouts-square-btn outline"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submittingPayout}
                  className="payouts-square-btn primary"
                >
                  {submittingPayout ? 'Recording...' : `Confirm & Pay ₹${payoutModalTarget.balanceDue}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Printable / PDF Partner Statement */}
      {statementPartner && (
        <div className="payout-modal-overlay statement-overlay" onClick={() => setStatementPartner(null)}>
          <div className="statement-sheet-card printable-statement" onClick={e => e.stopPropagation()}>
            {/* Statement Header */}
            <div className="statement-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {branding?.customer_logo ? (
                  <img src={branding.customer_logo} alt="Logo" style={{ height: '36px', width: 'auto', borderRadius: '6px' }} />
                ) : null}
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                    {branding?.app_name || 'Quickly'} Partner Payout Statement
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Generated on {new Date().toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="statement-actions no-print">
                <button 
                  type="button" 
                  onClick={handlePrintStatement} 
                  className="payouts-square-btn primary sm"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button 
                  type="button" 
                  onClick={() => handleExportPartnerStatementCSV(statementPartner)} 
                  className="payouts-square-btn outline sm"
                >
                  <Download size={14} /> CSV
                </button>
                <button 
                  type="button" 
                  onClick={() => setStatementPartner(null)} 
                  className="payout-modal-close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Partner Details Banner */}
            <div className="statement-partner-meta">
              <div className="meta-col">
                <span className="meta-lbl">Partner Name:</span>
                <span className="meta-val">{statementPartner.partner_name}</span>
              </div>
              <div className="meta-col">
                <span className="meta-lbl">Partner Code:</span>
                <span className="meta-val">{statementPartner.partner_code}</span>
              </div>
              <div className="meta-col">
                <span className="meta-lbl">Role:</span>
                <span className="meta-val">{activeTab === 'rider' ? 'Delivery Partner (Rider)' : 'Dark Store Shopkeeper'}</span>
              </div>
              <div className="meta-col">
                <span className="meta-lbl">Contact Phone:</span>
                <span className="meta-val">{statementPartner.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Financial Summary KPIs */}
            <div className="statement-kpi-row">
              <div className="st-kpi">
                <span className="st-lbl">Delivered Orders</span>
                <span className="st-val">{statementPartner.orderCount}</span>
              </div>
              <div className="st-kpi">
                <span className="st-lbl">Total Basket Handled</span>
                <span className="st-val">₹{statementPartner.totalBasket}</span>
              </div>
              <div className="st-kpi">
                <span className="st-lbl">Commissions Earned</span>
                <span className="st-val green">₹{statementPartner.totalEarned}</span>
              </div>
              <div className="st-kpi">
                <span className="st-lbl">Total Settled</span>
                <span className="st-val">₹{statementPartner.totalPaid}</span>
              </div>
              <div className="st-kpi">
                <span className="st-lbl">Balance Due</span>
                <span className={`st-val ${statementPartner.balanceDue > 0 ? 'amber' : 'green'}`}>
                  ₹{statementPartner.balanceDue}
                </span>
              </div>
            </div>

            {/* Detailed Orders Breakdown Table */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                Itemized Order History
              </h4>
              <table className="statement-orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Order #</th>
                    <th>Basket (Subtotal)</th>
                    <th>Delivery Fee</th>
                    <th>Partner Earnings</th>
                    <th>Settlement Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statementPartner.commissionsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                        No orders recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    statementPartner.commissionsList.map(c => {
                      const share = activeTab === 'rider' ? c.rider_share : c.shop_share;
                      return (
                        <tr key={c.id || c.order_id}>
                          <td>{new Date(c.calculated_at || c.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>#{c.order_id.slice(0, 8).toUpperCase()}</td>
                          <td>₹{c.subtotal}</td>
                          <td>₹{c.delivery_fee}</td>
                          <td style={{ fontWeight: '800', color: '#15803d' }}>₹{share}</td>
                          <td>
                            <span className={`comm-status-pill ${c.status || 'pending'}`}>
                              {c.status === 'paid' ? 'Paid / Settled' : 'Pending Settlement'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Settlement History */}
            {statementPartner.payoutsList.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>
                  Recorded Settlement Transactions
                </h4>
                <table className="statement-orders-table">
                  <thead>
                    <tr>
                      <th>Paid At</th>
                      <th>Amount</th>
                      <th>Mode</th>
                      <th>Reference Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementPartner.payoutsList.map(p => (
                      <tr key={p.id}>
                        <td>{new Date(p.paid_at).toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: '800', color: '#15803d' }}>₹{p.total_amount}</td>
                        <td style={{ textTransform: 'uppercase', fontWeight: '700' }}>{p.payment_mode}</td>
                        <td>{p.reference_note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer / Signature Box */}
            <div className="statement-footer">
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                Official settlement document of {branding?.app_name || 'Quickly'}. For discrepancies, contact support with Order ID.
              </div>
              <div className="statement-sign-box">
                <div className="sign-line"></div>
                <span>Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
