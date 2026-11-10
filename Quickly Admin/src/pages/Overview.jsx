import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShoppingCart, Package, DollarSign } from 'lucide-react';
import { db } from '../services/db';
import './Overview.css';

const mockChartData = [
  { month: 'Feb', sales: 12500, orders: 400 },
  { month: 'Mar', sales: 25000, orders: 600 },
  { month: 'Apr', sales: 45000, orders: 850 },
  { month: 'May', sales: 38000, orders: 750 },
  { month: 'Jun', sales: 65000, orders: 1100 },
  { month: 'Jul', sales: 92000, orders: 1500 },
];

const Overview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0
  });
  const [rawOrders, setRawOrders] = useState([]);
  const [timeframe, setTimeframe] = useState('6M'); // '6M' | '1Y' | 'ALL'
  const [chartData, setChartData] = useState([]);

  const generateChartData = (orders, tf) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const generated = [];

    if (tf === '6M') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mLabel = months[d.getMonth()];

        const monthOrders = orders.filter(o => {
          const oDate = new Date(o.created_at);
          return oDate.getMonth() === d.getMonth() && oDate.getFullYear() === d.getFullYear();
        });

        generated.push({
          month: mLabel,
          sales: monthOrders.reduce((sum, o) => sum + (o.total || 0), 0),
          orders: monthOrders.length
        });
      }
    } else if (tf === '1Y') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mLabel = months[d.getMonth()];
        const yr = String(d.getFullYear()).slice(-2);

        const monthOrders = orders.filter(o => {
          const oDate = new Date(o.created_at);
          return oDate.getMonth() === d.getMonth() && oDate.getFullYear() === d.getFullYear();
        });

        generated.push({
          month: `${mLabel} '${yr}`,
          sales: monthOrders.reduce((sum, o) => sum + (o.total || 0), 0),
          orders: monthOrders.length
        });
      }
    } else {
      // 'ALL' - all historical orders grouped chronologically
      if (orders.length === 0) {
        return [{ month: months[now.getMonth()], sales: 0, orders: 0 }];
      }

      let earliest = new Date();
      orders.forEach(o => {
        const oDate = new Date(o.created_at);
        if (oDate < earliest) earliest = oDate;
      });

      const startYear = earliest.getFullYear();
      const startMonth = earliest.getMonth();
      const endYear = now.getFullYear();
      const endMonth = now.getMonth();
      const totalMonths = Math.max(1, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
      const monthsToDisplay = Math.max(6, totalMonths);

      for (let i = monthsToDisplay - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mLabel = months[d.getMonth()];
        const yr = String(d.getFullYear()).slice(-2);

        const monthOrders = orders.filter(o => {
          const oDate = new Date(o.created_at);
          return oDate.getMonth() === d.getMonth() && oDate.getFullYear() === d.getFullYear();
        });

        generated.push({
          month: `${mLabel} '${yr}`,
          sales: monthOrders.reduce((sum, o) => sum + (o.total || 0), 0),
          orders: monthOrders.length
        });
      }
    }

    return generated;
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (rawOrders.length > 0) {
      setChartData(generateChartData(rawOrders, timeframe));
    }
  }, [timeframe, rawOrders]);

  const loadStats = async () => {
    const products = await db.products.getAll();
    const orders = await db.orders.getAllAdmin();
    
    // Calculate total true revenue (non-cancelled)
    const validOrders = (orders || []).filter(o => o.status !== 'Cancelled');
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    // Distinct user IDs from orders as proxy for active users
    const uniqueUsers = new Set((orders || []).map(o => o.profile_id)).size;

    setRawOrders(validOrders);
    setStats({
      totalUsers: uniqueUsers || 1,
      totalOrders: validOrders.length,
      totalProducts: (products || []).length,
      totalRevenue: totalRevenue
    });

    setChartData(generateChartData(validOrders, timeframe));
  };

  return (
    <div className="overview-page">
      <div className="overview-top-row">
        
        {/* Brand Card (Zipit Unique Identity) - Clickable to open Revenues */}
        <div className="brand-summary-card" onClick={() => navigate('/revenues')} style={{ cursor: 'pointer' }} title="Click to view detailed Revenues & Settlements">
          <div className="brand-header">
            <img src="/logo_full.png" alt="Zipit" className="brand-logo" />
            <span className="brand-subtitle">India's Rural Delivery App</span>
          </div>
          
          <div className="brand-metrics">
            <div className="growth-badge">
              <TrendingUp size={16} />
              <span>+18.5% Growth</span>
            </div>
            
            <div className="brand-metric-item">
              <span className="b-value">₹{(stats.totalRevenue / 1000).toFixed(1)}K</span>
              <span className="b-label">Current GMV (View ↗)</span>
            </div>
            
            <div className="brand-metric-item">
              <span className="b-value">{stats.totalOrders.toLocaleString()}</span>
              <span className="b-label">Total Orders</span>
            </div>
          </div>
        </div>

        <div className="quick-stats-container">
          <div className="stat-card" onClick={() => navigate('/users')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon-wrapper blue">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <h3>{stats.totalUsers.toLocaleString()}</h3>
              <p>Active Users</p>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/orders')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon-wrapper green">
              <ShoppingCart size={24} />
            </div>
            <div className="stat-info">
              <h3>{(stats.totalOrders).toLocaleString()}</h3>
              <p>Total Orders</p>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/products')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon-wrapper purple">
              <Package size={24} />
            </div>
            <div className="stat-info">
              <h3>{stats.totalProducts}</h3>
              <p>Live Products</p>
            </div>
          </div>

          <div className="stat-card" onClick={() => navigate('/revenues')} style={{ cursor: 'pointer' }} title="Click to open Revenue & Financial Analytics">
            <div className="stat-icon-wrapper orange">
              <DollarSign size={24} />
            </div>
            <div className="stat-info">
              <h3>₹{(stats.totalRevenue).toLocaleString()}</h3>
              <p>Gross Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="chart-section">
        <div className="chart-header">
          <h3>
            Sales & Orders Trend ({timeframe === '6M' ? 'Last 6 Months' : timeframe === '1Y' ? 'Last 1 Year' : 'All Time History'})
          </h3>
          <div className="chart-filters">
            <button 
              className={timeframe === '6M' ? 'active' : ''} 
              onClick={() => setTimeframe('6M')}
            >
              6M
            </button>
            <button 
              className={timeframe === '1Y' ? 'active' : ''} 
              onClick={() => setTimeframe('1Y')}
            >
              1Y
            </button>
            <button 
              className={timeframe === 'ALL' ? 'active' : ''} 
              onClick={() => setTimeframe('ALL')}
            >
              ALL
            </button>
          </div>
        </div>
        
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECF0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#667085', fontSize: 12}} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#667085', fontSize: 12}} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#667085', fontSize: 12}} dx={10} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Line yAxisId="left" type="monotone" dataKey="sales" name="Revenue (₹)" stroke="#F8CB46" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#16A34A" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Overview;
